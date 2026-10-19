using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WUD2026.Auth;
using WUD2026.Data;

namespace WUD2026.IntegrationTests;

public sealed class IdentityAccountTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private const string Password = "OnlyForIntegration2026!";
    private static WebApplicationFactory<Program> App(TestDatabase database) => new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Identity:BootstrapAdmin:Email"] = "", ["Identity:BootstrapAdmin:Password"] = "",
            ["Identity:RequireConfirmedEmail"] = "false", ["Email:Smtp:Host"] = "",
            ["Authentication:Google:ClientId"] = "test-client", ["Authentication:Google:ClientSecret"] = "test-secret"
        }));
        builder.ConfigureTestServices(services => { services.RemoveAll<IDbContextFactory<ContentDbContext>>(); services.AddSingleton(database.Factory); });
    });
    private static async Task Csrf(HttpClient client)
    {
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var token = await client.GetFromJsonAsync<JsonElement>("/api/account/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
    }
    private static async Task Register(HttpClient client, string email, string role = "User")
    {
        await Csrf(client);
        var result = await client.PostAsJsonAsync("/api/account/register", new RegisterRequest(email, Password, "Meloman", role, role == "School" ? "Szkoła muzyczna" : null));
        result.EnsureSuccessStatusCode(); await Csrf(client);
    }
    private static async Task<JsonElement> User(HttpClient client) => (await client.GetFromJsonAsync<JsonElement>("/api/account/session")).GetProperty("user");

    [Fact]
    public async Task FavoriteArtistsPersistAcrossSessionsAndStaySeparateFromEvents()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database);
        using var client = app.CreateClient(); using var second = app.CreateClient();
        await Register(client, "artist-favorites@example.org");
        var id = (await User(client)).GetProperty("id").GetString()!;
        (await client.PutAsJsonAsync("/api/account/favorites", new FavoriteRequest(["event-1"], id))).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync("/api/account/favorite-artists", new FavoriteArtistsRequest(["nazwa-wiktoria-jakubowska", "nazwa-wiktoria-jakubowska"], id))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/account/favorite-artists", new FavoriteArtistsRequest(["other"], "wrong-user"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/account/favorite-artists", new FavoriteArtistsRequest([new string('x',201)], id))).StatusCode);
        await Csrf(second);
        (await second.PostAsJsonAsync("/api/account/login", new LoginRequest("artist-favorites@example.org", Password, false))).EnsureSuccessStatusCode();
        var user = await User(second);
        Assert.Equal("event-1", user.GetProperty("favoriteEventIds")[0].GetString());
        Assert.Single(user.GetProperty("favoriteArtistIds").EnumerateArray());
        Assert.Equal("nazwa-wiktoria-jakubowska", user.GetProperty("favoriteArtistIds")[0].GetString());
        await Csrf(second);
        (await second.PutAsJsonAsync("/api/account/favorite-artists", new FavoriteArtistsRequest([],id))).EnsureSuccessStatusCode();
        Assert.Empty((await User(client)).GetProperty("favoriteArtistIds").EnumerateArray());
        using var anonymous = app.CreateClient(); await Csrf(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsJsonAsync("/api/account/favorite-artists", new FavoriteArtistsRequest([],id))).StatusCode);
    }

    [Fact]
    public async Task RegistrationUsesIdentityHashAndCookieAndCannotSelfGrantAdmin()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database); using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/content")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/register", new RegisterRequest("blocked@example.org", Password, "Test", "Admin", null))).StatusCode);
        await Csrf(client);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/register", new RegisterRequest("blocked@example.org", Password, "Test", "Admin", null))).StatusCode);
        await Register(client, "listener@example.org");
        var user = await User(client); Assert.Equal("User", user.GetProperty("roles")[0].GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/admin/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/account/users")).StatusCode);
        await using var db = await database.Factory.CreateDbContextAsync();
        var stored = await db.Users.SingleAsync(); Assert.NotEqual(Password, stored.PasswordHash); Assert.NotEmpty(stored.SecurityStamp!);
        var profile = await client.PutAsJsonAsync("/api/account/profile", new ProfileRequest("Anna", "123456789", null, null)); profile.EnsureSuccessStatusCode();
        Assert.Equal("Anna", (await User(client)).GetProperty("displayName").GetString());
        await client.PostAsJsonAsync("/api/account/logout", new { });
        await Csrf(client);
        Assert.Equal(JsonValueKind.Null, (await User(client)).ValueKind);
        (await client.PostAsJsonAsync("/api/account/login", new LoginRequest("listener@example.org", Password, false))).EnsureSuccessStatusCode();
        Assert.Equal("Anna", (await User(client)).GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task SchoolProfileFavoritesAndExportPersistAndPasswordChangeInvalidatesOtherSession()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database); using var client = app.CreateClient(); using var second = app.CreateClient();
        await Register(client, "school@example.org", "School");
        (await client.PutAsJsonAsync("/api/account/profile", new ProfileRequest("Szkoła", "", "Szkoła nr 1", "Szczecin"))).EnsureSuccessStatusCode();
        var id = (await User(client)).GetProperty("id").GetString()!;
        (await client.PutAsJsonAsync("/api/account/favorites", new FavoriteRequest(["event-1"], id))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync("/api/account/favorites", new FavoriteRequest(["wrong-account"], "another-id"))).StatusCode);
        var exported = await client.GetFromJsonAsync<JsonElement>("/api/account/export");
        Assert.Equal("School", exported.GetProperty("roles")[0].GetString()); Assert.Equal("event-1", exported.GetProperty("favoriteEventIds")[0].GetString());
        Assert.DoesNotContain("passwordHash", exported.ToString(), StringComparison.OrdinalIgnoreCase);
        await Csrf(second); (await second.PostAsJsonAsync("/api/account/login", new LoginRequest("school@example.org", Password, false))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/password", new PasswordRequest("wrong", "NewIntegration2026!"))).StatusCode);
        (await client.PostAsJsonAsync("/api/account/password", new PasswordRequest(Password, "NewIntegration2026!"))).EnsureSuccessStatusCode();
        Assert.Equal(JsonValueKind.Null, (await User(second)).ValueKind);
        Assert.Equal(id, (await User(client)).GetProperty("id").GetString());
    }

    [Fact]
    public async Task RolesRequireAdminAndLastAdminCannotBeDemotedOrDeleted()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database); using var client = app.CreateClient();
        await Csrf(client);
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var admin = new ApplicationUser { UserName = "admin@example.org", Email = "admin@example.org", DisplayName = "Admin" };
            Assert.True((await manager.CreateAsync(admin, Password)).Succeeded); Assert.True((await manager.AddToRoleAsync(admin, "Admin")).Succeeded);
        }
        (await client.PostAsJsonAsync("/api/account/login", new LoginRequest("admin@example.org", Password, false))).EnsureSuccessStatusCode(); await Csrf(client);
        var id = (await User(client)).GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/content")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/account/users")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/account/users/" + id + "/role", new RoleRequest("User"))).StatusCode);
        using var delete = new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new DeleteAccountRequest(Password, "USUŃ")) };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(delete)).StatusCode);
        using var ordinary = app.CreateClient(); await Register(ordinary, "ordinary@example.org");
        var ordinaryId = (await User(ordinary)).GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.Forbidden, (await ordinary.PutAsJsonAsync("/api/account/users/" + ordinaryId + "/role", new RoleRequest("Admin"))).StatusCode);
        (await client.PutAsJsonAsync("/api/account/users/" + ordinaryId + "/role", new RoleRequest("School"))).EnsureSuccessStatusCode();
        Assert.Equal(JsonValueKind.Null, (await User(ordinary)).ValueKind);
    }

    [Fact]
    public async Task PasswordResetTokensAreValidatedAndDeleteCascadesIdentityData()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database); using var client = app.CreateClient();
        await Register(client, "reset@example.org");
        string token;
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await manager.FindByEmailAsync("reset@example.org"))!;
            token = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(System.Text.Encoding.UTF8.GetBytes(await manager.GeneratePasswordResetTokenAsync(user)));
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/reset-password", new ResetPasswordRequest("reset@example.org", "invalid", Password))).StatusCode);
        (await client.PostAsJsonAsync("/api/account/reset-password", new ResetPasswordRequest("reset@example.org", token, "ResetIntegration2026!"))).EnsureSuccessStatusCode();
        await Csrf(client); (await client.PostAsJsonAsync("/api/account/login", new LoginRequest("reset@example.org", "ResetIntegration2026!", false))).EnsureSuccessStatusCode(); await Csrf(client);
        using var delete = new HttpRequestMessage(HttpMethod.Delete, "/api/account") { Content = JsonContent.Create(new DeleteAccountRequest("ResetIntegration2026!", "USUŃ")) };
        (await client.SendAsync(delete)).EnsureSuccessStatusCode();
        await using var db = await database.Factory.CreateDbContextAsync(); Assert.Empty(await db.Users.ToArrayAsync()); Assert.Empty(await db.UserRoles.ToArrayAsync());
    }

    [Fact]
    public async Task ProviderChallengeRequiresCsrfAndAllowlistedReturnAndNeverAutoLinksMissingExternalProof()
    {
        var database = await postgres.CreateDatabaseAsync(); await using var app = App(database);
        using var client = app.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        await Csrf(client);
        var invalid = new FormUrlEncodedContent(new Dictionary<string, string> { ["frontend"] = "https://evil.invalid" });
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/account/external/Google", invalid)).StatusCode);
        var form = new FormUrlEncodedContent(new Dictionary<string, string> { ["frontend"] = "http://127.0.0.1:4200" });
        var challenge = await client.PostAsync("/api/account/external/Google", form);
        Assert.True(challenge.StatusCode == HttpStatusCode.Redirect, await challenge.Content.ReadAsStringAsync()); Assert.Contains("accounts.google.com", challenge.Headers.Location!.Host);
        Assert.Contains("signin-google", challenge.Headers.Location.Query); Assert.DoesNotContain("test-secret", challenge.Headers.Location.ToString());
        var forged = await client.GetAsync("/api/account/external/callback?frontend=http%3A%2F%2F127.0.0.1%3A4200");
        Assert.Equal(HttpStatusCode.Redirect, forged.StatusCode); Assert.Contains("external_failed", forged.Headers.Location!.ToString());
        await using var db = await database.Factory.CreateDbContextAsync(); Assert.Empty(await db.Users.ToArrayAsync());
    }
}
