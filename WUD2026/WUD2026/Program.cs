using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using WUD2026.Chat;
using Microsoft.EntityFrameworkCore;
using WUD2026.Data;
using WUD2026.Models;
using WUD2026.Services;
using WUD2026.Auth;
using Microsoft.AspNetCore.Antiforgery;

var builder = WebApplication.CreateBuilder(args);
// Operational configuration comes from environment/host arguments, never appsettings or user-secrets files.
foreach (var source in builder.Configuration.Sources.OfType<Microsoft.Extensions.Configuration.Json.JsonConfigurationSource>().ToArray())
    builder.Configuration.Sources.Remove(source);
builder.Configuration.AddEnvironmentVariables();
builder.AddProductionHosting();
var localHosts = NetworkInterface.GetAllNetworkInterfaces()
    .Where(network => network.OperationalStatus == OperationalStatus.Up)
    .SelectMany(network => network.GetIPProperties().UnicastAddresses)
    .Where(address => address.Address.AddressFamily == AddressFamily.InterNetwork)
    .Select(address => address.Address.ToString())
    .Concat(new[] { "localhost", "127.0.0.1", Environment.MachineName })
    .Distinct(StringComparer.OrdinalIgnoreCase);
var localOrigins = (builder.Environment.IsDevelopment()
    ? localHosts.SelectMany(host => new[] { $"http://{host}:4200", $"http://{host}:4201" })
    : Enumerable.Empty<string>())
    .Concat(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
builder.Services.AddControllers();
builder.Services.AddHttpClient<ICuratorModel, OpenAiCuratorModel>(client => client.Timeout = TimeSpan.FromSeconds(45));
builder.Services.AddScoped<CuratorChatService>();
builder.Services.AddHostedService<ChatCleanupWorker>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) => await context.HttpContext.Response.WriteAsJsonAsync(
        new { message = "Zwolnijmy na chwilę. Spróbuj ponownie za minutę." }, token);
    options.AddPolicy("curator", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("accounts", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddOpenApi();
builder.Services.AddPooledDbContextFactory<ContentDbContext>(options =>
    options.UseNpgsql(DatabaseConnection.FromConfiguration(builder.Configuration)));
builder.Services.AddSingleton(TimeProvider.System);
builder.AddAccounts();
builder.Services.AddScoped<IContentStore, DatabaseContentStore>();
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddHostedService<PublicationWorker>();
builder.Services.AddHealthChecks().AddCheck<ContentDatabaseHealthCheck>("postgresql");
builder.Services.AddCors(options => options.AddPolicy("LocalEditors", policy => policy.WithOrigins(localOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.Use(async (context, next) =>
    {
        try { await next(); }
        catch (Exception error)
        {
            app.Logger.LogError("Unhandled request failure ({Type}) at {Path}", error.GetType().Name, context.Request.Path);
            if (context.Response.HasStarted) throw;
            context.Response.Clear();
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { message = "Nie udało się obsłużyć żądania. Spróbuj ponownie później." });
        }
    });
}
await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
    await scope.ServiceProvider.GetRequiredService<IdentityInitializer>().InitializeAsync();
}
if (app.Configuration["Import:File"] is { Length: > 0 } importFile)
{
    await using var scope = app.Services.CreateAsyncScope();
    await OfficialRepertoireImporter.ImportAsync(importFile, scope.ServiceProvider.GetRequiredService<IContentStore>(), app.Logger);
    return;
}
app.MapHealthChecks("/health/ready");
app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.UseCors("LocalEditors");
app.UseMiddleware<ContentExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapChatEndpoints();
app.MapAccounts(localOrigins);

if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.MapControllers();

app.MapGet("/api/events", async (IContentStore store, CancellationToken cancellationToken) =>
{
    var document = await store.ReadAsync(cancellationToken);
    return document.Events.Where(item => ContentValidation.IsPublished(item, DateTimeOffset.UtcNow)).OrderBy(item => item.Date).ThenBy(item => item.Time);
});
app.MapGet("/api/homepage", async (IContentStore store, CancellationToken cancellationToken) =>
{
    var document = await store.ReadAsync(cancellationToken);
    var featured = document.Events.FirstOrDefault(item => item.Id == document.PublishedHero.FeaturedEventId && ContentValidation.IsPublished(item, DateTimeOffset.UtcNow));
    return new HomePageResponse(document.PublishedHero, featured, document.Revision, document.UpdatedAt);
});

// Editorial management requires an authenticated administrator and CSRF protection.
var admin = app.MapGroup("/api/admin").RequireAuthorization(policy => policy.RequireRole(AccountRoles.Admin)).AddEndpointFilter(async (context, next) =>
{
    var request = context.HttpContext.Request;
    var origin = request.Headers.Origin.ToString();
    if (origin.Length > 0 && !localOrigins.Contains(origin)) return Results.StatusCode(StatusCodes.Status403Forbidden);
    if (!HttpMethods.IsGet(request.Method))
    {
        try { await context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context.HttpContext); }
        catch (AntiforgeryValidationException) { return Results.BadRequest(new { message = "Odśwież sesję formularza." }); }
    }
    return await next(context);
});
admin.MapGet("/content", async (IContentStore store, CancellationToken cancellationToken) => await store.ReadAsync(cancellationToken));
admin.MapGet("/homepage-preview", async (IContentStore store, CancellationToken cancellationToken) =>
{
    var document = await store.ReadAsync(cancellationToken);
    return new HomePageResponse(document.DraftHero, document.Events.FirstOrDefault(item => item.Id == document.DraftHero.FeaturedEventId), document.Revision, document.UpdatedAt);
});
admin.MapPut("/hero", async (SaveHeroRequest request, IContentStore store, CancellationToken cancellationToken) =>
    await store.UpdateAsync(request.Revision, document =>
    {
        ContentValidation.ValidateHero(request.Hero, document);
        document.DraftHero = request.Hero!;
    }, operation: "hero.draft.save", cancellationToken: cancellationToken));
admin.MapPost("/hero/publish", async (PublishHeroRequest request, IContentStore store, CancellationToken cancellationToken) =>
    await store.UpdateAsync(request.Revision, document =>
    {
        ContentValidation.ValidateHero(document.DraftHero, document);
        var publicationTime = request.PublishAt ?? DateTimeOffset.UtcNow;
        if (publicationTime > DateTimeOffset.UtcNow.AddYears(2)) throw new ContentValidationException("Termin publikacji może wybiegać maksymalnie dwa lata do przodu.");
        var featured = document.Events.First(item => item.Id == document.DraftHero.FeaturedEventId);
        if (!ContentValidation.IsPublished(featured, publicationTime))
            throw new ContentValidationException("Promowane wydarzenie musi być opublikowane najpóźniej w terminie publikacji hero.");
        if (publicationTime > DateTimeOffset.UtcNow)
        {
            document.ScheduledHero = document.DraftHero;
            document.HeroPublishAt = publicationTime;
        }
        else
        {
            document.PublishedHero = document.DraftHero;
            document.ScheduledHero = null;
            document.HeroPublishAt = null;
        }
    }, operation: "hero.publish", cancellationToken: cancellationToken));
admin.MapDelete("/hero/schedule", async (long revision, IContentStore store, CancellationToken cancellationToken) =>
    await store.UpdateAsync(revision, document =>
    {
        document.ScheduledHero = null;
        document.HeroPublishAt = null;
    }, operation: "hero.schedule.cancel", cancellationToken: cancellationToken));
admin.MapPut("/events/{id}", async (string id, SaveEventRequest request, IContentStore store, CancellationToken cancellationToken) =>
    await store.UpdateAsync(request.Revision, document =>
    {
        var item = request.Event is null ? null : EventTags.Normalize(request.Event) with
        {
            TicketUrl = string.IsNullOrWhiteSpace(request.Event.TicketUrl) ? null : request.Event.TicketUrl.Trim()
        };
        ContentValidation.ValidateEvent(item);
        if (item!.Id != id) throw new ContentValidationException("Identyfikator wydarzenia nie zgadza się z adresem.");
        var index = document.Events.FindIndex(existing => existing.Id == id);
        var visibleHeroTime = document.HeroPublishAt ?? DateTimeOffset.UtcNow;
        var usedByPublished = document.PublishedHero.FeaturedEventId == id;
        var usedByScheduled = document.ScheduledHero?.FeaturedEventId == id;
        if (usedByPublished && !ContentValidation.IsPublished(item, DateTimeOffset.UtcNow)
            || usedByScheduled && !ContentValidation.IsPublished(item, visibleHeroTime))
            throw new ContentValidationException("To wydarzenie jest promowane w hero. Zmień hero przed wycofaniem jego publikacji.");
        if (index >= 0) document.Events[index] = item;
        else document.Events.Add(item);
    }, operation: "event.save", cancellationToken: cancellationToken));

admin.MapGet("/history", async (IDbContextFactory<ContentDbContext> factory, int? limit, long? beforeRevision, CancellationToken cancellationToken) =>
{
    await using var db = await factory.CreateDbContextAsync(cancellationToken);
    return await db.Revisions.AsNoTracking()
        .Where(x => !beforeRevision.HasValue || x.Revision < beforeRevision.Value)
        .OrderByDescending(x => x.Revision).Take(Math.Clamp(limit ?? 20, 1, 100))
        .Select(x => new { x.Revision, x.CreatedAt, x.Operation }).ToListAsync(cancellationToken);
});
admin.MapGet("/history/{revision:long}", async (long revision, IDbContextFactory<ContentDbContext> factory, CancellationToken cancellationToken) =>
{
    await using var db = await factory.CreateDbContextAsync(cancellationToken);
    var snapshot = await db.Revisions.Where(x => x.Revision == revision).Select(x => x.Snapshot).SingleOrDefaultAsync(cancellationToken);
    return snapshot is null ? Results.NotFound() : Results.Content(snapshot, "application/json");
});

app.Run();

public partial class Program { }
