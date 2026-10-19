using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WUD2026.Models;
using WUD2026.Services;

namespace WUD2026.Data;

public sealed class DatabaseInitializer(IDbContextFactory<ContentDbContext> factory,
    IWebHostEnvironment environment, IConfiguration configuration, ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        // Serialize the whole startup sequence, including migration discovery, across API processes.
        // A session lock survives EF's own migration transactions.
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_lock(20261017, 0)", cancellationToken);
            try { await InitializeCoreAsync(db, cancellationToken); }
            finally
            {
                await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock(20261017, 0)", CancellationToken.None);
            }
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }

    private async Task InitializeCoreAsync(ContentDbContext db, CancellationToken cancellationToken)
    {
        if (configuration.GetValue("Database:ApplyMigrationsOnStartup", true))
            await db.Database.MigrateAsync(cancellationToken);
        else if ((await db.Database.GetPendingMigrationsAsync(cancellationToken)).Any())
            throw new InvalidOperationException("Baza wymaga migracji. Uruchom dotnet ef database update.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // A transaction-scoped advisory lock makes first startup safe across multiple instances.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(20261017, 1)", cancellationToken);
        if (await db.SiteStates.AnyAsync(cancellationToken))
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }
        var legacyPath = configuration["Content:FilePath"]
            ?? Path.Combine(environment.ContentRootPath, "App_Data", "site-content.json");
        var path = File.Exists(legacyPath) ? legacyPath : Path.Combine(environment.ContentRootPath, "Seed", "content.json");
        await using var stream = File.OpenRead(path);
        var document = await JsonSerializer.DeserializeAsync<ContentDocument>(stream, DatabaseContentStore.JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Nie można zaimportować danych początkowych.");
        Validate(document);
        document.UpdatedAt = document.UpdatedAt.ToUniversalTime();
        db.SiteStates.Add(new SiteState
        {
            Revision = document.Revision,
            UpdatedAt = document.UpdatedAt,
            HeroPublishAt = document.HeroPublishAt?.ToUniversalTime()
        });
        DatabaseContentStore.Synchronize(db, [], [], document);
        db.Revisions.Add(new ContentRevision
        {
            Revision = document.Revision,
            CreatedAt = document.UpdatedAt,
            Operation = File.Exists(legacyPath) ? "content.import-json" : "content.seed",
            Snapshot = JsonSerializer.Serialize(document, DatabaseContentStore.JsonOptions)
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation("Imported content into PostgreSQL: {Events} events, revision {Revision}. Source file preserved.", document.Events.Count, document.Revision);
    }

    private static void Validate(ContentDocument document)
    {
        if (document.Revision < 1 || document.Events.Select(x => x.Id).Distinct().Count() != document.Events.Count)
            throw new InvalidDataException("Niepoprawna rewizja lub powtórzone identyfikatory wydarzeń w imporcie.");
        foreach (var item in document.Events) ContentValidation.ValidateEvent(item);
        ContentValidation.ValidateHero(document.DraftHero, document);
        ContentValidation.ValidateHero(document.PublishedHero, document);
        if (document.ScheduledHero is not null) ContentValidation.ValidateHero(document.ScheduledHero, document);
        if ((document.ScheduledHero is null) != (document.HeroPublishAt is null))
            throw new InvalidDataException("Zaplanowane hero i termin publikacji muszą być zapisane razem.");
    }
}
