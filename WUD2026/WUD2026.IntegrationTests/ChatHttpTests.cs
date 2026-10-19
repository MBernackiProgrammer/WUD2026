using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WUD2026.Chat;
using WUD2026.Data;

namespace WUD2026.IntegrationTests;

public sealed class ChatHttpTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task PublicChatContractRestoresContextProtectsSessionAndProvidesCalendarDownload()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using var app = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDbContextFactory<ContentDbContext>>(); services.AddSingleton(database.Factory);
            services.RemoveAll<ICuratorModel>(); services.AddSingleton<ICuratorModel>(new CuratorChatTests.RecordingModel());
        }));
        using var client = app.CreateClient();
        var created = await client.PostAsJsonAsync("/api/chat/sessions", new { }); created.EnsureSuccessStatusCode();
        var session = (await created.Content.ReadFromJsonAsync<ChatSessionResponse>())!;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/chat/sessions/" + session.SessionId)).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.Token);
        var sent = await client.PostAsJsonAsync($"/api/chat/sessions/{session.SessionId}/messages", new ChatRequest(Guid.NewGuid(), 0, "Pierwszy koncert"));
        sent.EnsureSuccessStatusCode();
        var result = (await sent.Content.ReadFromJsonAsync<ChatSessionResponse>())!;
        Assert.Equal(2, result.Messages.Length); Assert.Null(result.Token);
        var restored = (await client.GetFromJsonAsync<ChatSessionResponse>("/api/chat/sessions/" + session.SessionId))!;
        Assert.Equal(result.Messages.Last().Text, restored.Messages.Last().Text);
        Assert.Empty(result.Messages.Last().Events);
        var recommended = await client.PostAsJsonAsync($"/api/chat/sessions/{session.SessionId}/messages", new ChatRequest(Guid.NewGuid(), 1, "Sam, bez limitu, dowolny termin"));
        recommended.EnsureSuccessStatusCode();
        var card = (await recommended.Content.ReadFromJsonAsync<ChatSessionResponse>())!.Messages.Last().Events.Single();
        var calendar = await client.GetAsync("/api" + card.CalendarPath);
        calendar.EnsureSuccessStatusCode();
        Assert.Equal("text/calendar", calendar.Content.Headers.ContentType!.MediaType);
        Assert.Contains("BEGIN:VEVENT", await calendar.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/chat/sessions/" + session.SessionId)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/chat/sessions/" + session.SessionId)).StatusCode);
    }
}
