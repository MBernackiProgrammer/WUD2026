using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WUD2026.Data;
using WUD2026.Models;

namespace WUD2026.IntegrationTests;

public sealed class HttpContractTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private static async Task<HttpClient> AdminClient(WebApplicationFactory<Program> app)
    {
        var client = app.CreateClient();
        client.DefaultRequestHeaders.Add("X-Contract-Admin", "true");
        var token = await client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/account/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
        return client;
    }
    private static WebApplicationFactory<Program> CreateApp(TestDatabase database, string environment = "Development", bool failDatabase = false) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IDbContextFactory<ContentDbContext>>();
                services.AddSingleton(database.Factory);
                services.AddSingleton<IStartupFilter, LoopbackStartupFilter>();
                if (failDatabase)
                {
                    services.RemoveAll<WUD2026.Services.IContentStore>();
                    services.AddSingleton<WUD2026.Services.IContentStore, UnavailableContentStore>();
                }
            });
        });

    [Fact]
    public async Task GoogleCalendarRedirectUsesPublishedEventAndRejectsUnknownId()
    {
        var database = await postgres.CreateDatabaseAsync();
        var document = await database.Store.ReadAsync();
        var item = document.Events.First(e => e.PublicationState == "published");
        await using var app = CreateApp(database);
        using var client = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var response = await client.GetAsync("/api/events/" + item.Id + "/calendar/google");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("calendar.google.com", response.Headers.Location?.Host);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/events/missing/calendar/google")).StatusCode);
    }

    [Fact]
    public async Task ExistingAdminContractSupportsDraftPreviewPublishHistoryAndValidation()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using var app = CreateApp(database);
        using var client = await AdminClient(app);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        var first = (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
        var draft = first.DraftHero with { Title = "Zapis przez HTTP" };
        var save = await client.PutAsJsonAsync("/api/admin/hero", new SaveHeroRequest(first.Revision, draft));
        save.EnsureSuccessStatusCode();
        var saved = (await save.Content.ReadFromJsonAsync<ContentDocument>())!;
        Assert.Equal(first.PublishedHero.Title, (await client.GetFromJsonAsync<HomePageResponse>("/api/homepage"))!.Hero.Title);
        Assert.Equal(draft.Title, (await client.GetFromJsonAsync<HomePageResponse>("/api/admin/homepage-preview"))!.Hero.Title);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/admin/hero", new SaveHeroRequest(first.Revision, draft))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/admin/hero", new SaveHeroRequest(saved.Revision,
            draft with { PrimaryHref = "//external.invalid" }))).StatusCode);
        var publish = await client.PostAsJsonAsync("/api/admin/hero/publish", new PublishHeroRequest(saved.Revision, null));
        publish.EnsureSuccessStatusCode();
        Assert.Equal(draft.Title, (await client.GetFromJsonAsync<HomePageResponse>("/api/homepage"))!.Hero.Title);
        var history = await client.GetFromJsonAsync<List<HistoryRow>>("/api/admin/history?limit=2");
        Assert.Equal(2, history!.Count);
        Assert.Equal("hero.publish", history[0].Operation);
        var snapshot = await client.GetFromJsonAsync<ContentDocument>($"/api/admin/history/{history[0].Revision}");
        Assert.Equal(draft.Title, snapshot!.PublishedHero.Title);
    }

    [Fact]
    public async Task DraftEventsAreHiddenAndPublishedEventChangesPersist()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using var app = CreateApp(database);
        using var client = await AdminClient(app);
        var first = (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
        var item = first.Events[0] with { Id = "http-event", PublicationState = "draft", Price = 27.50m, TicketUrl = "https://tickets.example.org/event/http-event?source=filharmonia&seat=1", Program = ["Utwór A", "Utwór B"] };
        var save = await client.PutAsJsonAsync("/api/admin/events/http-event", new SaveEventRequest(first.Revision, item));
        save.EnsureSuccessStatusCode();
        var saved = (await save.Content.ReadFromJsonAsync<ContentDocument>())!;
        Assert.DoesNotContain((await client.GetFromJsonAsync<List<EventContent>>("/api/events"))!, x => x.Id == item.Id);
        var publish = await client.PutAsJsonAsync("/api/admin/events/http-event", new SaveEventRequest(saved.Revision, item with { PublicationState = "published" }));
        publish.EnsureSuccessStatusCode();
        var events = (await client.GetFromJsonAsync<List<EventContent>>("/api/events"))!;
        var result = Assert.Single(events, x => x.Id == item.Id);
        Assert.Equal(27.50m, result.Price);
        Assert.Equal(item.Program, result.Program);
        Assert.Equal(item.TicketUrl, result.TicketUrl);
        var current = (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
        (await client.PutAsJsonAsync("/api/admin/events/http-event", new SaveEventRequest(current.Revision,
            item with { PublicationState = "published", TicketUrl = "" }))).EnsureSuccessStatusCode();
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Null((await db.Events.SingleAsync(x => x.Id == item.Id)).TicketUrl);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("//tickets.example.org/event")]
    [InlineData("/wydarzenie/test")]
    [InlineData("http://tickets.example.org/event")]
    [InlineData("https://user:password@tickets.example.org/event")]
    [InlineData("https://tickets.example.org/has space")]
    public async Task InvalidSellerLinkIsRejectedWithoutChangingContent(string url)
    {
        var database = await postgres.CreateDatabaseAsync();
        await using var app = CreateApp(database);
        using var client = await AdminClient(app);
        var current = (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
        var item = current.Events[0] with { TicketUrl = url };
        var response = await client.PutAsJsonAsync("/api/admin/events/" + item.Id, new SaveEventRequest(current.Revision, item));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(current.Revision, (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!.Revision);
    }

    [Fact]
    public async Task RecreatedApiHostKeepsDatabaseContentInsteadOfReseeding()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using (var firstApp = CreateApp(database))
        {
            using var client = await AdminClient(firstApp);
            var content = (await client.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
            (await client.PutAsJsonAsync("/api/admin/hero", new SaveHeroRequest(content.Revision,
                content.DraftHero with { Title = "Zachowane po restarcie API" }))).EnsureSuccessStatusCode();
        }
        await using var restarted = CreateApp(database);
        using var secondClient = await AdminClient(restarted);
        var result = (await secondClient.GetFromJsonAsync<ContentDocument>("/api/admin/content"))!;
        Assert.Equal("Zachowane po restarcie API", result.DraftHero.Title);
        Assert.Equal(2, result.Revision);
    }

    [Fact]
    public async Task DatabaseFailureReturns503WithoutLeakingDriverDetails()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using var app = CreateApp(database, failDatabase: true);
        using var client = await AdminClient(app);
        var response = await client.GetAsync("/api/homepage");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Npgsql", body);
        Assert.DoesNotContain("driver-detail", body);
        Assert.Contains("message", body);
    }

    [Fact]
    public async Task ForeignOriginsAndProductionManagementRemainBlocked()
    {
        var database = await postgres.CreateDatabaseAsync();
        await using (var app = CreateApp(database))
        {
            using var client = await AdminClient(app);
            client.DefaultRequestHeaders.Add("Origin", "https://external.invalid");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/content")).StatusCode);
        }
        await using var production = CreateApp(database, "Production");
        using var publicClient = production.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await publicClient.GetAsync("/api/admin/content")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync("/api/homepage")).StatusCode);
    }

    private sealed record HistoryRow(long Revision, DateTimeOffset CreatedAt, string Operation);
}

internal sealed class LoopbackStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, continuation) =>
        {
            context.Connection.RemoteIpAddress = IPAddress.Loopback;
            if (context.Request.Headers["X-Contract-Admin"] == "true")
                context.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
                    [new(System.Security.Claims.ClaimTypes.NameIdentifier, "contract-admin"), new(System.Security.Claims.ClaimTypes.Role, "Admin")], "ContractTests"));
            return continuation(context);
        });
        next(app);
    };
}

internal sealed class UnavailableContentStore : WUD2026.Services.IContentStore
{
    public Task<ContentDocument> ReadAsync(CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("transient", new Npgsql.NpgsqlException("driver-detail"));
    public Task<ContentDocument> UpdateAsync(long expectedRevision, Action<ContentDocument> update,
        string operation = "content.update", CancellationToken cancellationToken = default) => ReadAsync(cancellationToken);
    public Task PublishDueAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}

