using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WUD2026.Data;
using WUD2026.Models;
using WUD2026.Services;

namespace WUD2026.Chat;

public sealed class CuratorChatService(IDbContextFactory<ContentDbContext> factory, IContentStore content,
    ICuratorModel model, TimeProvider clock, IConfiguration configuration, ILogger<CuratorChatService> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<ChatSessionResponse> CreateAsync(CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var session = new ChatSession
        {
            Id = Guid.NewGuid(),
            TokenHash = Hash(token),
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now.AddDays(Math.Clamp(configuration.GetValue("Ai:SessionDays", 7), 1, 30))
        };
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        db.ChatSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return new(session.Id, token, 0, session.ExpiresAt, []);
    }

    public async Task<ChatSessionResponse> GetAsync(Guid id, string token, CancellationToken cancellationToken)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var session = await AuthenticateAsync(db, id, token, cancellationToken);
        var catalog = await content.ReadAsync(cancellationToken);
        return await ResponseAsync(db, session, catalog, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, string token, CancellationToken cancellationToken)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        await AuthenticateAsync(db, id, token, cancellationToken);
        await db.ChatSessions.Where(x => x.Id == id).ExecuteDeleteAsync(cancellationToken);
    }

    public async Task<ChatSessionResponse> SendAsync(Guid id, string token, ChatRequest request, CancellationToken cancellationToken)
    {
        var question = request.Text?.Trim() ?? "";
        if (request.RequestId == Guid.Empty || question.Length is < 1 or > 2000 || request.ExpectedTurn < 0)
            throw new ChatException(400, "Wpisz wiadomość o długości od 1 do 2000 znaków.");
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var session = await AuthenticateAsync(db, id, token, cancellationToken);
        var existing = await db.ChatTurns.AsNoTracking().SingleOrDefaultAsync(x => x.SessionId == id && x.RequestId == request.RequestId, cancellationToken);
        if (existing is not null)
        {
            if (existing.Question != question) throw new ChatException(409, "Identyfikator wiadomości został już użyty.");
            return await ResponseAsync(db, session, await content.ReadAsync(cancellationToken), cancellationToken);
        }
        if (!model.IsConfigured) throw new ChatException(503, "Przewodnik jest chwilowo niedostępny. Spróbuj ponownie później.");
        if (session.Turn >= Math.Clamp(configuration.GetValue("Ai:MaxTurns", 50), 5, 100))
            throw new ChatException(409, "Ta rozmowa osiągnęła limit długości. Rozpocznij nową rozmowę.");
        var now = clock.GetUtcNow();
        var acquired = await db.ChatSessions.Where(x => x.Id == id && x.Turn == request.ExpectedTurn && x.ExpiresAt > now
                && (x.LeaseUntil == null || x.LeaseUntil <= now))
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.LeaseId, request.RequestId)
                .SetProperty(x => x.LeaseUntil, now.AddSeconds(90)), cancellationToken);
        if (acquired == 0) throw new ChatException(409, "Rozmowa została zaktualizowana albo odpowiedź jest właśnie przygotowywana. Odśwież rozmowę.");
        try
        {
            // No database transaction is held while waiting for the model.
            var history = await db.ChatTurns.AsNoTracking().Where(x => x.SessionId == id).OrderByDescending(x => x.Number)
                .Take(8).OrderBy(x => x.Number).ToArrayAsync(cancellationToken);
            var catalog = await content.ReadAsync(cancellationToken);
            var upcoming = catalog.Events.Where(x => IsUpcoming(x, now)).OrderBy(x => x.Date).ThenBy(x => x.Time).ToArray();
            var candidates = Candidates(upcoming, question, session.Memory, history);
            var answer = await model.AnswerAsync(new(session.Memory, history, candidates, upcoming.Length, now, question), cancellationToken);
            ValidateAnswer(answer, candidates, history.Length > 0);
            // Recheck publication and links after generation; a redactor may have changed the catalogue.
            var latest = await content.ReadAsync(cancellationToken);
            if (answer.Recommendations.Any(x => !latest.Events.Any(e => e.Id == x.EventId && IsUpcoming(e, clock.GetUtcNow()))))
                throw new ChatException(409, "Repertuar zmienił się podczas rozmowy. Spróbuj ponownie, aby otrzymać aktualne propozycje.");
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            db.ChangeTracker.Clear();
            var locked = await db.ChatSessions.FromSqlInterpolated($"SELECT * FROM \"ChatSessions\" WHERE \"Id\" = {id} FOR UPDATE")
                .SingleOrDefaultAsync(cancellationToken);
            if (locked is null || locked.ExpiresAt <= clock.GetUtcNow()) throw new ChatException(410, "Rozmowa wygasła. Rozpocznij nową.");
            if (locked.LeaseId != request.RequestId || locked.Turn != request.ExpectedTurn)
                throw new ChatException(409, "Kontekst rozmowy został zmieniony. Odśwież rozmowę.");
            locked.Turn++;
            locked.Memory = answer.Memory;
            locked.UpdatedAt = clock.GetUtcNow();
            locked.LeaseId = null;
            locked.LeaseUntil = null;
            db.ChatTurns.Add(new ChatTurn
            {
                SessionId = id,
                RequestId = request.RequestId,
                Number = locked.Turn,
                Question = question,
                Reply = answer.Reply,
                Recommendations = JsonSerializer.Serialize(answer.Recommendations, Json),
                FollowUps = answer.FollowUps,
                CatalogRevision = latest.Revision,
                CreatedAt = locked.UpdatedAt
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await ResponseAsync(db, locked, latest, cancellationToken);
        }
        finally
        {
            try
            {
                await using var release = await factory.CreateDbContextAsync(CancellationToken.None);
                await release.ChatSessions.Where(x => x.Id == id && x.LeaseId == request.RequestId)
                    .ExecuteUpdateAsync(set => set.SetProperty(x => x.LeaseId, (Guid?)null)
                        .SetProperty(x => x.LeaseUntil, (DateTimeOffset?)null), CancellationToken.None);
            }
            catch (Exception) { logger.LogWarning("Chat lease release failed; the bounded lease will expire automatically."); }
        }
    }

    private async Task<ChatSession> AuthenticateAsync(ContentDbContext db, Guid id, string token, CancellationToken cancellationToken)
    {
        if (token.Length != 64) throw new ChatException(401, "Nie można otworzyć tej rozmowy.");
        var session = await db.ChatSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (session is null || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(session.TokenHash), Encoding.ASCII.GetBytes(Hash(token))))
            throw new ChatException(401, "Nie można otworzyć tej rozmowy.");
        if (session.ExpiresAt <= clock.GetUtcNow()) throw new ChatException(410, "Rozmowa wygasła. Rozpocznij nową.");
        return session;
    }

    private async Task<ChatSessionResponse> ResponseAsync(ContentDbContext db, ChatSession session, ContentDocument catalog, CancellationToken cancellationToken)
    {
        var turns = await db.ChatTurns.AsNoTracking().Where(x => x.SessionId == session.Id && x.Number <= session.Turn)
            .OrderBy(x => x.Number).ToListAsync(cancellationToken);
        var messages = new List<ChatMessage>();
        foreach (var turn in turns)
        {
            messages.Add(new(turn.RequestId + ":user", true, turn.Question, [], []));
            var events = new List<ChatEvent>();
            foreach (var recommendation in JsonSerializer.Deserialize<Recommendation[]>(turn.Recommendations, Json) ?? [])
            {
                var item = catalog.Events.FirstOrDefault(x => x.Id == recommendation.EventId && ContentValidation.IsPublished(x, clock.GetUtcNow()));
                if (item is null) continue;
                var upcoming = IsUpcoming(item, clock.GetUtcNow());
                events.Add(new(item, recommendation.Reason, recommendation.Insight, "/wydarzenie/" + Uri.EscapeDataString(item.Id),
                    upcoming && item.Status != "sold-out" ? item.TicketUrl : null,
                    upcoming ? EventCalendar.GoogleUrl(item) : null,
                    upcoming ? "/events/" + Uri.EscapeDataString(item.Id) + "/calendar.ics" : null));
            }
            messages.Add(new(turn.RequestId + ":assistant", false, turn.Reply, events.ToArray(), turn.FollowUps));
        }
        return new(session.Id, null, session.Turn, session.ExpiresAt, messages.ToArray());
    }

    private static EventContent[] Candidates(EventContent[] events, string question, string memory, ChatTurn[] history)
    {
        var words = (question + " " + memory).ToLowerInvariant().Split([' ', ',', '.', ';', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Where(x => x.Length >= 4).Distinct().Take(120).ToArray();
        var previousIds = history.TakeLast(2).SelectMany(x => JsonSerializer.Deserialize<Recommendation[]>(x.Recommendations, Json) ?? [])
            .Select(x => x.EventId).ToHashSet();
        return events.OrderByDescending(e => previousIds.Contains(e.Id) ? 1000 : 0)
            .ThenByDescending(e => words.Count(word => (e.Title + " " + e.Category + " " + e.Mood + " " + e.Audience + " " + e.Description + " " + string.Join(" ", e.Program)).Contains(word, StringComparison.OrdinalIgnoreCase)))
            .ThenBy(e => e.Date).ThenBy(e => e.Time).ThenBy(e => e.Id, StringComparer.Ordinal).Take(60).ToArray();
    }

    private static bool IsUpcoming(EventContent item, DateTimeOffset now)
    {
        if (!ContentValidation.IsPublished(item, now)) return false;
        try { return EventCalendar.Start(item) > now; }
        catch (ChatException) { return false; }
    }

    private static void ValidateAnswer(CuratorAnswer answer, EventContent[] candidates, bool canRecommend)
    {
        if (string.IsNullOrWhiteSpace(answer.Reply) || answer.Reply.Length > 8000 || answer.Memory is null || answer.Memory.Length > 4000
            || answer.Recommendations is null || answer.Recommendations.Length > (canRecommend ? 1 : 0) || answer.FollowUps is null || answer.FollowUps.Length > 3
            || answer.FollowUps.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 180)
            || answer.Recommendations.Any(x => x is null || !candidates.Any(e => e.Id == x.EventId)
                || string.IsNullOrWhiteSpace(x.Reason) || x.Reason.Length > 1000 || x.Insight is null || x.Insight.Length > 2000)
            || answer.Recommendations.Select(x => x.EventId).Distinct().Count() != answer.Recommendations.Length)
            throw new ChatException(502, "Propozycja wymaga ponownego przygotowania. Spróbuj ponownie.");
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
