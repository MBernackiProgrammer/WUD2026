using WUD2026.Models;

namespace WUD2026.Chat;

public sealed class ChatSession
{
    public Guid Id { get; set; }
    public string TokenHash { get; set; } = "";
    public string Memory { get; set; } = "";
    public int Turn { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTimeOffset? LeaseUntil { get; set; }
}

public sealed class ChatTurn
{
    public Guid SessionId { get; set; }
    public Guid RequestId { get; set; }
    public int Number { get; set; }
    public string Question { get; set; } = "";
    public string Reply { get; set; } = "";
    public string Recommendations { get; set; } = "[]";
    public string[] FollowUps { get; set; } = [];
    public long CatalogRevision { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed record ChatRequest(Guid RequestId, int ExpectedTurn, string? Text);
public sealed record Recommendation(string EventId, string Reason, string Insight);
public sealed record CuratorAnswer(string Reply, Recommendation[] Recommendations, string Memory, string[] FollowUps);
public sealed record ChatEvent(EventContent Event, string Reason, string Insight, string DetailUrl,
    string? TicketUrl, string? GoogleCalendarUrl, string? CalendarPath);
public sealed record ChatMessage(string Id, bool User, string Text, ChatEvent[] Events, string[] FollowUps);
public sealed record ChatSessionResponse(Guid SessionId, string? Token, int Turn, DateTimeOffset ExpiresAt, ChatMessage[] Messages);
public sealed record CuratorContext(string Memory, ChatTurn[] History, EventContent[] Events,
    int TotalUpcomingEvents, DateTimeOffset Now, string Question);

public interface ICuratorModel
{
    bool IsConfigured { get; }
    Task<CuratorAnswer> AnswerAsync(CuratorContext context, CancellationToken cancellationToken);
}

public sealed class ChatException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
