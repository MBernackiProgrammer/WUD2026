using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using WUD2026.Data;
using WUD2026.Models;
using WUD2026.Services;

namespace WUD2026.IntegrationTests;

public sealed class PersistenceTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task MigrationsAndSeedAreIdempotentAndUseNativePostgresTypes()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        await database.Initializer.InitializeAsync();
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Equal(6, await db.Events.CountAsync());
        Assert.Equal(2, await db.HeroVersions.CountAsync());
        Assert.Single(await db.Revisions.ToListAsync());
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        var entity = await db.Events.FirstAsync();
        Assert.Equal(first.Events.First(x => x.Id == entity.Id).Date, entity.Date.ToString("yyyy-MM-dd"));
        Assert.NotEmpty(entity.Program);
        Assert.Equal(1, (await database.Store.ReadAsync()).Revision);
    }

    [Fact]
    public async Task ConcurrentFirstStartupCreatesOnlyOneSeedAndOneSchema()
    {
        var database = await postgres.CreateDatabaseAsync(initialize: false);
        await Task.WhenAll(database.Initializer.InitializeAsync(), database.Initializer.InitializeAsync());
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Equal(6, await db.Events.CountAsync());
        Assert.Single(await db.SiteStates.ToListAsync());
        Assert.Single(await db.Revisions.ToListAsync());
    }

    [Fact]
    public async Task DraftPersistsAcrossStoreInstancesWithoutChangingPublishedHero()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        var saved = await database.Store.UpdateAsync(first.Revision,
            doc => doc.DraftHero = doc.DraftHero with { Title = "Trwały szkic" }, "hero.draft.save");
        var reloaded = await new DatabaseContentStore(database.Factory, database.Clock).ReadAsync();
        Assert.Equal("Trwały szkic", reloaded.DraftHero.Title);
        Assert.Equal(first.PublishedHero.Title, reloaded.PublishedHero.Title);
        Assert.Equal(saved.Revision, reloaded.Revision);
        await using var db = await database.Factory.CreateDbContextAsync();
        var audit = await db.Revisions.SingleAsync(x => x.Revision == saved.Revision);
        Assert.Equal("hero.draft.save", audit.Operation);
        Assert.Contains("Trwały szkic", audit.Snapshot);
    }

    [Fact]
    public async Task ConcurrentInstancesCannotOverwriteTheSameRevision()
    {
        var database = await postgres.CreateDatabaseAsync();
        var revision = (await database.Store.ReadAsync()).Revision;
        async Task<bool> Save(string title)
        {
            try
            {
                await database.Store.UpdateAsync(revision, doc => doc.DraftHero = doc.DraftHero with { Title = title });
                return true;
            }
            catch (ContentConflictException) { return false; }
        }
        var outcomes = await Task.WhenAll(Save("Pierwszy zapis"), Save("Drugi zapis"));
        Assert.Single(outcomes, x => x);
        Assert.Equal(revision + 1, (await database.Store.ReadAsync()).Revision);
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Equal(2, await db.Revisions.CountAsync());
    }

    [Fact]
    public async Task FailedDatabaseWriteRollsBackContentRevisionAndAuditTogether()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        await Assert.ThrowsAsync<DbUpdateException>(() => database.Store.UpdateAsync(first.Revision, doc =>
            doc.DraftHero = doc.DraftHero with { Title = "Nie zapisuj", FeaturedEventId = "missing-event" }));
        var reloaded = await database.Store.ReadAsync();
        Assert.Equal(first.Revision, reloaded.Revision);
        Assert.Equal(first.DraftHero.Title, reloaded.DraftHero.Title);
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Single(await db.Revisions.ToListAsync());
    }

    [Fact]
    public async Task ScheduledSnapshotIsIndependentOfLaterDraftEdits()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        var saved = await database.Store.UpdateAsync(first.Revision, doc =>
        {
            doc.ScheduledHero = doc.DraftHero with { Title = "Zaplanowane hero" };
            doc.HeroPublishAt = database.Clock.Now.AddMinutes(10);
        });
        await database.Store.UpdateAsync(saved.Revision, doc => doc.DraftHero = doc.DraftHero with { Title = "Późniejszy szkic" });
        database.Clock.Now = database.Clock.Now.AddMinutes(11);
        await database.Store.PublishDueAsync();
        var result = await database.Store.ReadAsync();
        Assert.Equal("Zaplanowane hero", result.PublishedHero.Title);
        Assert.Equal("Późniejszy szkic", result.DraftHero.Title);
        Assert.Null(result.ScheduledHero);
        Assert.Null(result.HeroPublishAt);
    }

    [Fact]
    public async Task WorkerPublishesHeroAndEventWithoutAnyPublicRequest()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        await database.Store.UpdateAsync(first.Revision, doc =>
        {
            doc.Events.Add(doc.Events[0] with { Id = "scheduled-test", PublicationState = "scheduled", PublishAt = database.Clock.Now.AddMinutes(1) });
            doc.ScheduledHero = doc.DraftHero with { Title = "Publikacja w tle", FeaturedEventId = "scheduled-test" };
            doc.HeroPublishAt = database.Clock.Now.AddMinutes(1);
        });
        database.Clock.Now = database.Clock.Now.AddMinutes(2);
        await using var provider = new ServiceCollection().AddSingleton(database.Factory).AddSingleton<TimeProvider>(database.Clock)
            .AddScoped<IContentStore, DatabaseContentStore>().BuildServiceProvider();
        using var worker = new PublicationWorker(provider.GetRequiredService<IServiceScopeFactory>(), database.Configuration,
            NullLogger<PublicationWorker>.Instance);
        await worker.StartAsync(CancellationToken.None);
        var complete = false;
        for (var attempt = 0; attempt < 40; attempt++)
        {
            await using var db = await database.Factory.CreateDbContextAsync();
            complete = await db.HeroVersions.AnyAsync(x => x.Slot == "published" && x.Title == "Publikacja w tle");
            if (complete) break;
            await Task.Delay(100);
        }
        await worker.StopAsync(CancellationToken.None);
        Assert.True(complete);
        await using var verification = await database.Factory.CreateDbContextAsync();
        var item = await verification.Events.SingleAsync(x => x.Id == "scheduled-test");
        Assert.Equal("published", item.PublicationState);
        Assert.Null(item.PublishAt);
        Assert.Equal("publication.due", (await verification.Revisions.OrderByDescending(x => x.Revision).FirstAsync()).Operation);
    }

    [Fact]
    public async Task CancelledScheduleDoesNotPublishAndRepeatedTicksAreIdempotent()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        var saved = await database.Store.UpdateAsync(first.Revision, doc =>
        {
            doc.ScheduledHero = doc.DraftHero with { Title = "Nie publikuj" };
            doc.HeroPublishAt = database.Clock.Now.AddMinutes(1);
        });
        var cancelled = await database.Store.UpdateAsync(saved.Revision, doc => { doc.ScheduledHero = null; doc.HeroPublishAt = null; });
        database.Clock.Now = database.Clock.Now.AddMinutes(2);
        await Task.WhenAll(database.Store.PublishDueAsync(), database.Store.PublishDueAsync());
        var result = await database.Store.ReadAsync();
        Assert.Equal(first.PublishedHero.Title, result.PublishedHero.Title);
        Assert.Equal(cancelled.Revision, result.Revision);
    }

    [Fact]
    public async Task DuePublicationRejectsStaleEditorButCommitsThePublication()
    {
        var database = await postgres.CreateDatabaseAsync();
        var first = await database.Store.ReadAsync();
        var saved = await database.Store.UpdateAsync(first.Revision, doc =>
        {
            doc.ScheduledHero = doc.DraftHero with { Title = "Termin ma pierwszeństwo" };
            doc.HeroPublishAt = database.Clock.Now.AddMinutes(1);
        });
        database.Clock.Now = database.Clock.Now.AddMinutes(2);
        await Assert.ThrowsAsync<ContentConflictException>(() => database.Store.UpdateAsync(saved.Revision,
            doc => doc.DraftHero = doc.DraftHero with { Title = "Stara rewizja" }));
        var result = await database.Store.ReadAsync();
        Assert.Equal("Termin ma pierwszeństwo", result.PublishedHero.Title);
        Assert.Equal(saved.Revision + 1, result.Revision);
        Assert.NotEqual("Stara rewizja", result.DraftHero.Title);
    }

    [Fact]
    public async Task LegacyFileImportsOnceAndIsNeverOverwritten()
    {
        await using var sourceStream = File.OpenRead(Path.Combine(AppContext.BaseDirectory, "Seed", "content.json"));
        var source = await JsonSerializer.DeserializeAsync<ContentDocument>(sourceStream,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        source!.Revision = 42;
        source.DraftHero = source.DraftHero with { Title = "Istniejąca treść klienta" };
        var path = Path.Combine(Path.GetTempPath(), "filharmonia-import-" + Guid.NewGuid().ToString("N") + ".json");
        var original = JsonSerializer.Serialize(source, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        try
        {
            await File.WriteAllTextAsync(path, original);
            var database = await postgres.CreateDatabaseAsync(path);
            Assert.Equal(42, (await database.Store.ReadAsync()).Revision);
            Assert.Equal("Istniejąca treść klienta", (await database.Store.ReadAsync()).DraftHero.Title);
            await database.Store.UpdateAsync(42, doc => doc.DraftHero = doc.DraftHero with { Title = "Nowszy zapis w bazie" });
            await database.Initializer.InitializeAsync();
            Assert.Equal("Nowszy zapis w bazie", (await database.Store.ReadAsync()).DraftHero.Title);
            Assert.Equal(original, await File.ReadAllTextAsync(path));
        }
        finally { File.Delete(path); }
    }
}
