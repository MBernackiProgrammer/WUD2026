using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using WUD2026.Data;

namespace WUD2026.Auth;

public static class IdentityConfiguration
{
    public static readonly string[] Providers = ["Google", "Facebook", "Apple", "Microsoft"];

    public static bool ProviderConfigured(IConfiguration config, string provider) => provider == "Apple"
        ? new[] { "ClientId", "TeamId", "KeyId", "PrivateKey" }.All(key => !string.IsNullOrWhiteSpace(config[$"Authentication:Apple:{key}"]))
        : !string.IsNullOrWhiteSpace(config[$"Authentication:{provider}:ClientId"])
            && !string.IsNullOrWhiteSpace(config[$"Authentication:{provider}:ClientSecret"]);

    public static void AddAccounts(this WebApplicationBuilder builder)
    {
        builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 12;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.SignIn.RequireConfirmedEmail = builder.Configuration.GetValue<bool>("Identity:RequireConfirmedEmail");
        }).AddEntityFrameworkStores<ContentDbContext>().AddDefaultTokenProviders();
        builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = "Filharmonia.Identity";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;
            options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
            options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
        });
        builder.Services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromHours(2));
        builder.Services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-CSRF-TOKEN";
            options.Cookie.Name = "Filharmonia.Csrf";
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });
        builder.Services.AddAuthorization();
        builder.Services.AddScoped<AccountEmailSender>();
        builder.Services.AddScoped<IdentityInitializer>();
        var auth = builder.Services.AddAuthentication();
        var config = builder.Configuration;
        auth.AddGoogle("Google", options =>
        {
            options.ClientId = ConfiguredValue(config, "Google", "ClientId");
            options.ClientSecret = ConfiguredValue(config, "Google", "ClientSecret");
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.CallbackPath = "/signin-google";
            options.Events.OnRemoteFailure = ExternalFailure;
        });
        auth.AddFacebook("Facebook", options =>
        {
            options.AppId = ConfiguredValue(config, "Facebook", "ClientId");
            options.AppSecret = ConfiguredValue(config, "Facebook", "ClientSecret");
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.CallbackPath = "/signin-facebook";
            options.Events.OnRemoteFailure = ExternalFailure;
        });
        auth.AddMicrosoftAccount("Microsoft", options =>
        {
            options.ClientId = ConfiguredValue(config, "Microsoft", "ClientId");
            options.ClientSecret = ConfiguredValue(config, "Microsoft", "ClientSecret");
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.CallbackPath = "/signin-microsoft";
            options.Events.OnRemoteFailure = ExternalFailure;
        });
        auth.AddOpenIdConnect("Apple", "Apple", options =>
        {
            options.Authority = "https://appleid.apple.com";
            options.ClientId = ConfiguredValue(config, "Apple", "ClientId");
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.CallbackPath = "/signin-apple";
            options.ResponseType = "code";
            options.ResponseMode = "form_post";
            options.UsePkce = false;
            options.MapInboundClaims = false;
            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("email");
            options.TokenValidationParameters.NameClaimType = "sub";
            options.ClaimActions.MapJsonKey(System.Security.Claims.ClaimTypes.NameIdentifier, "sub");
            options.ClaimActions.MapJsonKey(System.Security.Claims.ClaimTypes.Email, "email");
            options.Events = new OpenIdConnectEvents
            {
                OnAuthorizationCodeReceived = context =>
                {
                    context.TokenEndpointRequest!.ClientSecret = AppleClientSecret(config);
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    if (context.Principal?.Identity is System.Security.Claims.ClaimsIdentity identity
                        && !identity.HasClaim(claim => claim.Type == System.Security.Claims.ClaimTypes.NameIdentifier))
                    {
                        var subject = identity.FindFirst("sub")?.Value;
                        if (subject is not null) identity.AddClaim(new(System.Security.Claims.ClaimTypes.NameIdentifier, subject));
                    }
                    return Task.CompletedTask;
                },
                OnRemoteFailure = ExternalFailure
            };
        });
    }

    private static string ConfiguredValue(IConfiguration config, string provider, string key) =>
        string.IsNullOrWhiteSpace(config[$"Authentication:{provider}:{key}"]) ? "not-configured" : config[$"Authentication:{provider}:{key}"]!;

    private static Task ExternalFailure(RemoteFailureContext context)
    {
        // The origin was validated before the challenge and is protected in OAuth state.
        string? frontend = null;
        context.Properties?.Items.TryGetValue("frontend", out frontend);
        context.HandleResponse();
        if (frontend is not null) context.Response.Redirect(frontend + "/konto?authError=external_failed");
        else context.Response.StatusCode = 400;
        return Task.CompletedTask;
    }

    private static string AppleClientSecret(IConfiguration config)
    {
        using var key = ECDsa.Create();
        key.ImportFromPem(config["Authentication:Apple:PrivateKey"]!.Replace("\\n", "\n"));
        var securityKey = new ECDsaSecurityKey(key) { KeyId = config["Authentication:Apple:KeyId"] };
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(config["Authentication:Apple:TeamId"], "https://appleid.apple.com",
            [new("sub", ConfiguredValue(config, "Apple", "ClientId"))], now.AddSeconds(-30), now.AddMinutes(5),
            new SigningCredentials(securityKey, SecurityAlgorithms.EcdsaSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public sealed class IdentityInitializer(UserManager<ApplicationUser> users, RoleManager<IdentityRole> roles, IConfiguration config)
{
    public async Task InitializeAsync()
    {
        foreach (var role in AccountRoles.All)
            if (!await roles.RoleExistsAsync(role)) Ensure(await roles.CreateAsync(new IdentityRole(role)));
        var email = config["Identity:BootstrapAdmin:Email"];
        var password = config["Identity:BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new() { UserName = email, Email = email, EmailConfirmed = true, DisplayName = "Administrator" };
            Ensure(await users.CreateAsync(user, password));
        }
        if (!await users.IsInRoleAsync(user, AccountRoles.Admin))
        {
            Ensure(await users.RemoveFromRolesAsync(user, await users.GetRolesAsync(user)));
            Ensure(await users.AddToRoleAsync(user, AccountRoles.Admin));
            Ensure(await users.UpdateSecurityStampAsync(user));
        }
    }

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Identity initialization failed: " + string.Join(", ", result.Errors.Select(error => error.Code)));
    }
}


