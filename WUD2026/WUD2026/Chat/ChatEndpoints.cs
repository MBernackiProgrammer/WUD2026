using System.Text;
using WUD2026.Services;

namespace WUD2026.Chat;

public static class ChatEndpoints
{
    public static void MapChatEndpoints(this WebApplication app)
    {
        var chat = app.MapGroup("/api/chat").RequireRateLimiting("curator");
        chat.MapGet("/status", (ICuratorModel model) => new { configured = model.IsConfigured });
        chat.MapPost("/sessions", (CuratorChatService service, CancellationToken token) => service.CreateAsync(token));
        chat.MapGet("/sessions/{id:guid}", (Guid id, HttpContext http, CuratorChatService service, CancellationToken token) =>
            service.GetAsync(id, Bearer(http), token));
        chat.MapPost("/sessions/{id:guid}/messages", (Guid id, ChatRequest request, HttpContext http,
            CuratorChatService service, CancellationToken token) => service.SendAsync(id, Bearer(http), request, token));
        chat.MapDelete("/sessions/{id:guid}", async (Guid id, HttpContext http, CuratorChatService service, CancellationToken token) =>
        {
            await service.DeleteAsync(id, Bearer(http), token);
            return Results.NoContent();
        });
        app.MapGet("/api/events/{id}/calendar/google", async (string id, IContentStore store, TimeProvider clock, CancellationToken token) =>
        {
            var document = await store.ReadAsync(token);
            var item = document.Events.FirstOrDefault(x => x.Id == id && ContentValidation.IsPublished(x, clock.GetUtcNow()));
            return item is null ? Results.NotFound() : Results.Redirect(EventCalendar.GoogleUrl(item));
        });
        app.MapGet("/api/events/{id}/calendar.ics", async (string id, IContentStore store, TimeProvider clock, CancellationToken token) =>
        {
            var document = await store.ReadAsync(token);
            var item = document.Events.FirstOrDefault(x => x.Id == id && ContentValidation.IsPublished(x, clock.GetUtcNow()));
            if (item is null) return Results.NotFound();
            return Results.File(Encoding.UTF8.GetBytes(EventCalendar.Ics(item, clock.GetUtcNow())),
                "text/calendar; charset=utf-8", item.Id + ".ics");
        });
    }

    private static string Bearer(HttpContext http)
    {
        var value = http.Request.Headers.Authorization.ToString();
        return value.StartsWith("Bearer ", StringComparison.Ordinal) ? value[7..] : "";
    }
}
