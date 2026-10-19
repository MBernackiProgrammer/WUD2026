using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WUD2026.Chat;
using WUD2026.Data;

namespace WUD2026.IntegrationTests;

public sealed class CuratorChatTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private static CuratorChatService Service(TestDatabase db, ICuratorModel model) => new(db.Factory, db.Store, model,
        db.Clock, db.Configuration, NullLogger<CuratorChatService>.Instance);

    [Fact]
    public async Task ContextAndOrderedRecommendationsSurviveServiceRestartAndFollowUp()
    {
        var db = await postgres.CreateDatabaseAsync();
        var model = new RecordingModel();
        var service = Service(db, model);
        var session = await service.CreateAsync(default);
        var first = await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Lubię jazz, budżet do 80 zł"), default);
        var restarted = Service(db, model);
        var restored = await restarted.GetAsync(session.SessionId, session.Token!, default);
        Assert.Equal(2, restored.Messages.Length);
        var second = await restarted.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), first.Turn, "Opowiedz więcej o tej propozycji"), default);
        Assert.Equal(4, second.Messages.Length);
        Assert.Equal("Lubi jazz; budżet 80 zł.", model.Contexts[1].Memory);
        Assert.Single(model.Contexts[1].History);
        Assert.Equal("Lubię jazz, budżet do 80 zł", model.Contexts[1].History[0].Question);
        Assert.Empty(first.Messages.Last().Events);
        Assert.Equal("[]", model.Contexts[1].History[0].Recommendations);
        Assert.Single(second.Messages.Last().Events);
        await using var context = await db.Factory.CreateDbContextAsync();
        var stored = await context.ChatSessions.SingleAsync();
        Assert.NotEqual(session.Token, stored.TokenHash);
        Assert.Equal(1, (await db.Store.ReadAsync()).Revision); // Chats do not invalidate the CMS editor.
    }

    [Fact]
    public async Task IdempotentRetryDoesNotChargeAnotherModelCallOrAppendAnotherTurn()
    {
        var db = await postgres.CreateDatabaseAsync(); var model = new RecordingModel(); var service = Service(db, model);
        var session = await service.CreateAsync(default);
        var request = new ChatRequest(Guid.NewGuid(), 0, "Pierwszy koncert");
        var first = await service.SendAsync(session.SessionId, session.Token!, request, default);
        var retry = await service.SendAsync(session.SessionId, session.Token!, request, default);
        Assert.Equal(first.Turn, retry.Turn);
        Assert.Equal(first.Messages.Length, retry.Messages.Length);
        Assert.Single(model.Contexts);
    }

    [Fact]
    public async Task OtherTokenCannotReadOrDeleteConversationAndResetCascadesMessages()
    {
        var db = await postgres.CreateDatabaseAsync(); var service = Service(db, new RecordingModel());
        var first = await service.CreateAsync(default); var other = await service.CreateAsync(default);
        var forbidden = await Assert.ThrowsAsync<ChatException>(() => service.GetAsync(first.SessionId, other.Token!, default));
        Assert.Equal(401, forbidden.Status);
        await Assert.ThrowsAsync<ChatException>(() => service.DeleteAsync(first.SessionId, other.Token!, default));
        await service.SendAsync(first.SessionId, first.Token!, new(Guid.NewGuid(), 0, "Jazz"), default);
        await service.DeleteAsync(first.SessionId, first.Token!, default);
        await using var context = await db.Factory.CreateDbContextAsync();
        Assert.Empty(await context.ChatTurns.ToListAsync());
        Assert.Single(await context.ChatSessions.ToListAsync());
    }

    [Fact]
    public async Task UnknownEventsAreRejectedAndFailureLeavesNoPhantomMessageOrLockedSession()
    {
        var db = await postgres.CreateDatabaseAsync(); var model = new RecordingModel { InventId = true }; var service = Service(db, model);
        var session = await service.CreateAsync(default);
        await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Jazz"), default);
        var error = await Assert.ThrowsAsync<ChatException>(() => service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 1, "Sam, bez limitu, dowolny termin"), default));
        Assert.Equal(502, error.Status);
        Assert.Equal(2, (await service.GetAsync(session.SessionId, session.Token!, default)).Messages.Length);
        model.InventId = false;
        Assert.Equal(2, (await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 1, "Jazz"), default)).Turn);
    }

    [Fact]
    public async Task OnlyPublishedUpcomingEventsReachModelAndActionsComeFromDatabase()
    {
        var db = await postgres.CreateDatabaseAsync(); var catalog = await db.Store.ReadAsync();
        var ticket = "https://tickets.example.org/real-event?id=42";
        await db.Store.UpdateAsync(catalog.Revision, doc =>
        {
            var item = doc.Events[0];
            for (var index = 0; index < doc.Events.Count; index++) doc.Events[index] = doc.Events[index] with { TicketUrl = ticket };
            doc.Events.Add(item with { Id = "hidden", PublicationState = "draft" });
            doc.Events.Add(item with { Id = "not-yet-published", PublicationState = "scheduled", PublishAt = db.Clock.Now.AddDays(2) });
            doc.Events.Add(item with { Id = "past", Date = "2025-10-01" });
        });
        var model = new RecordingModel(); var service = Service(db, model); var session = await service.CreateAsync(default);
        await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Koncert"), default);
        var result = await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 1, "Sam, bez limitu, dowolny termin"), default);
        Assert.DoesNotContain(model.Contexts[0].Events, x => x.Id is "hidden" or "not-yet-published" or "past");
        var card = result.Messages.Last().Events.Single();
        Assert.Equal(ticket, card.TicketUrl);
        Assert.StartsWith("https://calendar.google.com/calendar/render?", card.GoogleCalendarUrl);
        Assert.EndsWith("/calendar.ics", card.CalendarPath);
        var current = await db.Store.ReadAsync();
        await db.Store.UpdateAsync(current.Revision, doc =>
        {
            var index = doc.Events.FindIndex(x => x.Id == card.Event.Id);
            doc.Events[index] = doc.Events[index] with { TicketUrl = "https://tickets.example.org/updated" };
        });
        Assert.Equal("https://tickets.example.org/updated", (await service.GetAsync(session.SessionId, session.Token!, default)).Messages.Last().Events.Single().TicketUrl);
    }

    [Fact]
    public async Task BoundedHistoryStillIncludesDurableMemoryFromEarlierTurns()
    {
        var db = await postgres.CreateDatabaseAsync(); var model = new RecordingModel(); var service = Service(db, model);
        var session = await service.CreateAsync(default);
        for (var turn = 0; turn < 11; turn++)
            await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), turn, "Dalsze pytanie " + turn), default);
        Assert.Equal(8, model.Contexts.Last().History.Length);
        Assert.Equal("Lubi jazz; budżet 80 zł.", model.Contexts.Last().Memory);
    }

    [Fact]
    public async Task ConcurrentRequestsForOneSessionDoNotLoseOrDuplicateContext()
    {
        var db = await postgres.CreateDatabaseAsync(); var model = new RecordingModel { Block = true }; var service = Service(db, model);
        var session = await service.CreateAsync(default);
        var first = service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Jazz"), default);
        await model.Started.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var conflict = await Assert.ThrowsAsync<ChatException>(() => Service(db, model).SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Druga wiadomość"), default));
        Assert.Equal(409, conflict.Status);
        model.Release.TrySetResult();
        Assert.Equal(1, (await first).Turn);
        Assert.Single(model.Contexts);
    }

    [Fact]
    public async Task UnconfiguredModelIsUnavailableInsteadOfReturningFakeAiAndExpiredSessionIsRejected()
    {
        var db = await postgres.CreateDatabaseAsync(); var model = new RecordingModel { IsConfigured = false }; var service = Service(db, model);
        var session = await service.CreateAsync(default);
        Assert.Equal(503, (await Assert.ThrowsAsync<ChatException>(() => service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Jazz"), default))).Status);
        Assert.Empty(model.Contexts);
        db.Clock.Now = db.Clock.Now.AddDays(8);
        Assert.Equal(410, (await Assert.ThrowsAsync<ChatException>(() => service.GetAsync(session.SessionId, session.Token!, default))).Status);
    }

    [Fact]
    public async Task RecommendationBeforeInterviewIsRejectedWithoutSavingOrLockingConversation()
    {
        var db = await postgres.CreateDatabaseAsync();
        var model = new RecordingModel
        {
            AnswerOverride = context => new("Polecam koncert.",
                [new(context.Events[0].Id, "Powód", "Kontekst")], "", [])
        };
        var service = Service(db, model);
        var session = await service.CreateAsync(default);
        var error = await Assert.ThrowsAsync<ChatException>(() => service.SendAsync(session.SessionId,
            session.Token!, new(Guid.NewGuid(), 0, "Poleć coś"), default));
        Assert.Equal(502, error.Status);
        Assert.Empty((await service.GetAsync(session.SessionId, session.Token!, default)).Messages);
        model.AnswerOverride = null;
        var response = await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Poleć coś"), default);
        Assert.Empty(response.Messages.Last().Events);
        Assert.Contains("Z kim", response.Messages.Last().Text);
        Assert.Contains("Przyjdę samodzielnie", response.Messages.Last().FollowUps);
    }

    [Fact]
    public async Task MultipleRecommendationsAreRejectedAfterInterviewAndSingleRecommendationCanBeRetried()
    {
        var db = await postgres.CreateDatabaseAsync();
        var model = new RecordingModel();
        var service = Service(db, model);
        var session = await service.CreateAsync(default);
        await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 0, "Lubię jazz"), default);
        model.AnswerOverride = context => new("Dwie propozycje.", context.Events.Take(2)
            .Select(item => new Recommendation(item.Id, "Powód", "Kontekst")).ToArray(), "", []);
        var error = await Assert.ThrowsAsync<ChatException>(() => service.SendAsync(session.SessionId,
            session.Token!, new(Guid.NewGuid(), 1, "Sam, dowolny termin, bez limitu"), default));
        Assert.Equal(502, error.Status);
        Assert.Equal(1, (await service.GetAsync(session.SessionId, session.Token!, default)).Turn);
        model.AnswerOverride = null;
        var response = await service.SendAsync(session.SessionId, session.Token!, new(Guid.NewGuid(), 1,
            "Sam, dowolny termin, bez limitu"), default);
        Assert.Single(response.Messages.Last().Events);
    }

    internal sealed class RecordingModel : ICuratorModel
    {
        public bool IsConfigured { get; set; } = true;
        public bool InventId { get; set; }
        public bool Block { get; set; }
        public Func<CuratorContext, CuratorAnswer>? AnswerOverride { get; set; }
        public List<CuratorContext> Contexts { get; } = [];
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task<CuratorAnswer> AnswerAsync(CuratorContext context, CancellationToken cancellationToken)
        {
            Contexts.Add(context); Started.TrySetResult();
            if (Block) await Release.Task.WaitAsync(cancellationToken);
            if (AnswerOverride is not null) return AnswerOverride(context);
            if (context.History.Length == 0)
                return new("Z kim przyjdziesz?", [], "Lubi jazz; budżet 80 zł.", ["Przyjdę samodzielnie", "Przyjdę z drugą osobą"]);
            return new("Spójrzmy na propozycję z repertuaru.", context.Events.Length == 0 ? [] :
                [new(InventId ? "invented" : context.Events[0].Id, "Dopasowanie do rozmowy.", "Kontekst muzyczny.")],
                "Lubi jazz; budżet 80 zł.", ["Opowiedz o programie"]);
        }
    }
}
