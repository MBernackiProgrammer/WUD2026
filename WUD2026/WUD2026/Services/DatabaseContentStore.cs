using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WUD2026.Data;
using WUD2026.Models;

namespace WUD2026.Services;

/// <summary>Each content operation locks the singleton revision row in PostgreSQL.
/// The lock protects the complete aggregate across requests and API instances.</summary>
public sealed class DatabaseContentStore(IDbContextFactory<ContentDbContext> factory, TimeProvider clock) : IContentStore
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Task<ContentDocument> ReadAsync(CancellationToken cancellationToken = default) =>
        ExecuteAsync(null, null, "publication.due", cancellationToken);

    public Task<ContentDocument> UpdateAsync(long expectedRevision, Action<ContentDocument> update,
        string operation = "content.update", CancellationToken cancellationToken = default) =>
        ExecuteAsync(expectedRevision, update, operation, cancellationToken);

    public async Task PublishDueAsync(CancellationToken cancellationToken = default)
    {
        // Avoid acquiring the aggregate write lock on every worker tick when nothing is due.
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var now = clock.GetUtcNow();
        var due = await db.SiteStates.AnyAsync(x => x.HeroPublishAt <= now, cancellationToken)
            || await db.Events.AnyAsync(x => x.PublicationState == "scheduled" && x.PublishAt <= now, cancellationToken);
        if (due) await ReadAsync(cancellationToken);
    }

    private async Task<ContentDocument> ExecuteAsync(long? expectedRevision, Action<ContentDocument>? update,
        string operation, CancellationToken cancellationToken)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        // Every writer (including the scheduler) acquires this row before loading dependent data.
        var state = await db.SiteStates.FromSqlRaw("SELECT * FROM \"SiteState\" WHERE \"Id\" = 1 FOR UPDATE")
            .SingleAsync(cancellationToken);
        var events = await db.Events.OrderBy(x => x.Date).ThenBy(x => x.Time).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var heroes = await db.HeroVersions.ToListAsync(cancellationToken);
        var document = ToDocument(state, events, heroes);
        var due = ApplyDuePublications(document, clock.GetUtcNow());
        if (expectedRevision.HasValue && (expectedRevision != document.Revision || due))
        {
            // Commit a due publication even if the editor's request has become stale.
            if (due)
            {
                await PersistAsync(db, state, events, heroes, document, "publication.due", cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            throw new ContentConflictException();
        }
        if (update is not null) update(document);
        if (due || update is not null)
        {
            await PersistAsync(db, state, events, heroes, document, operation, cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return document;
    }

    internal static ContentDocument ToDocument(SiteState state, List<ContentEvent> events, List<HeroVersion> heroes) => new()
    {
        Revision = state.Revision,
        UpdatedAt = state.UpdatedAt,
        HeroPublishAt = state.HeroPublishAt,
        DraftHero = ContentMapping.ToContent(heroes.Single(x => x.Slot == "draft")),
        PublishedHero = ContentMapping.ToContent(heroes.Single(x => x.Slot == "published")),
        ScheduledHero = heroes.FirstOrDefault(x => x.Slot == "scheduled") is { } scheduled ? ContentMapping.ToContent(scheduled) : null,
        Events = events.Select(ContentMapping.ToContent).ToList()
    };

    private static bool ApplyDuePublications(ContentDocument document, DateTimeOffset now)
    {
        var changed = false;
        for (var index = 0; index < document.Events.Count; index++)
        {
            var item = document.Events[index];
            if (item.PublicationState == "scheduled" && item.PublishAt <= now)
            {
                document.Events[index] = item with { PublicationState = "published", PublishAt = null };
                changed = true;
            }
        }
        if (document.ScheduledHero is not null && document.HeroPublishAt <= now)
        {
            document.PublishedHero = document.ScheduledHero;
            document.ScheduledHero = null;
            document.HeroPublishAt = null;
            changed = true;
        }
        return changed;
    }

    private async Task PersistAsync(ContentDbContext db, SiteState state, List<ContentEvent> events,
        List<HeroVersion> heroes, ContentDocument document, string operation, CancellationToken cancellationToken)
    {
        document.Revision++;
        document.UpdatedAt = clock.GetUtcNow();
        state.Revision = document.Revision;
        state.UpdatedAt = document.UpdatedAt;
        state.HeroPublishAt = document.HeroPublishAt?.ToUniversalTime();
        Synchronize(db, events, heroes, document);
        db.Revisions.Add(new ContentRevision
        {
            Revision = document.Revision,
            CreatedAt = document.UpdatedAt,
            Operation = operation,
            Snapshot = JsonSerializer.Serialize(document, JsonOptions)
        });
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw new ContentConflictException(); }
    }

    internal static void Synchronize(ContentDbContext db, List<ContentEvent> events, List<HeroVersion> heroes, ContentDocument document)
    {
        var existing = events.ToDictionary(x => x.Id);
        foreach (var item in document.Events)
        {
            var entity = ContentMapping.ToEntity(item);
            if (existing.TryGetValue(item.Id, out var tracked)) db.Entry(tracked).CurrentValues.SetValues(entity);
            else db.Events.Add(entity);
        }
        SetHero("draft", document.DraftHero);
        SetHero("published", document.PublishedHero);
        SetHero("scheduled", document.ScheduledHero);

        void SetHero(string slot, HeroContent? content)
        {
            var tracked = heroes.FirstOrDefault(x => x.Slot == slot);
            if (content is null)
            {
                if (tracked is not null) db.HeroVersions.Remove(tracked);
                return;
            }
            var entity = ContentMapping.ToEntity(slot, content);
            if (tracked is null) db.HeroVersions.Add(entity);
            else db.Entry(tracked).CurrentValues.SetValues(entity);
        }
    }
}
