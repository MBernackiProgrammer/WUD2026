using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using WUD2026.Data;

namespace WUD2026.Auth;

public static class AccountEndpoints
{
    public static void MapAccounts(this WebApplication app, string[] allowedOrigins)
    {
        var group = app.MapGroup("/api/account").RequireRateLimiting("accounts").AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store";
            if (!HttpMethods.IsGet(http.Request.Method) && !HttpMethods.IsHead(http.Request.Method))
            {
                try { await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http); }
                catch (AntiforgeryValidationException) { return Error("Sesja formularza wygasła. Odśwież stronę i spróbuj ponownie.", 400); }
            }
            try { return await next(context); }
            catch (SmtpException) { return Error("Nie udało się wysłać wiadomości e-mail. Spróbuj ponownie później.", 503); }
        });

        group.MapGet("/csrf", (HttpContext http, IAntiforgery antiforgery) =>
            Results.Ok(new { token = antiforgery.GetAndStoreTokens(http).RequestToken }));
        group.MapGet("/session", async (HttpContext http, UserManager<ApplicationUser> users, IConfiguration config, AccountEmailSender mail) =>
        {
            var user = await users.GetUserAsync(http.User);
            return Results.Ok(new
            {
                user = user is null ? null : await View(user, users),
                providers = IdentityConfiguration.Providers.Select(name => new { name, configured = IdentityConfiguration.ProviderConfigured(config, name) }),
                emailEnabled = mail.Available,
                requireConfirmedEmail = config.GetValue<bool>("Identity:RequireConfirmedEmail")
            });
        });

        group.MapPost("/register", async Task<IResult> (RegisterRequest request, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, AccountEmailSender mail, IConfiguration config) =>
        {
            if (!ValidEmail(request.Email) || string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Length > 100
                || request.Password is null || request.Password.Length > 128 || request.AccountType is not (AccountRoles.User or AccountRoles.School)
                || request.SchoolName?.Length > 200 || request.AccountType == AccountRoles.School && string.IsNullOrWhiteSpace(request.SchoolName))
                return Error("Podaj poprawny e-mail, imię i rodzaj konta. Konto szkolne wymaga nazwy szkoły.");
            if (config.GetValue<bool>("Identity:RequireConfirmedEmail") && !mail.Available) return Error("Rejestracja wymaga potwierdzenia e-mail. Skontaktuj się z Filharmonią.", 503);
            var user = new ApplicationUser { UserName = request.Email.Trim(), Email = request.Email.Trim(), DisplayName = request.DisplayName.Trim(), SchoolName = request.AccountType == AccountRoles.School ? request.SchoolName!.Trim() : "" };
            var result = await users.CreateAsync(user, request.Password);
            if (!result.Succeeded) return IdentityError(result);
            result = await users.AddToRoleAsync(user, request.AccountType);
            if (!result.Succeeded) { await users.DeleteAsync(user); return IdentityError(result); }
            if (mail.Available) await SendConfirmation(user, user.Email!, null, users, mail, config);
            if (config.GetValue<bool>("Identity:RequireConfirmedEmail")) return Results.Ok(new { requiresConfirmation = true });
            await signIn.SignInAsync(user, false);
            return Results.Ok(new { requiresConfirmation = false });
        });
        group.MapPost("/login", async Task<IResult> (LoginRequest request, SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users) =>
        {
            if (!ValidEmail(request.Email) || string.IsNullOrEmpty(request.Password) || request.Password.Length > 128) return Error("Nieprawidłowy e-mail lub hasło.", 401);
            var user = await users.FindByEmailAsync(request.Email.Trim());
            if (user is null) return Error("Nieprawidłowy e-mail lub hasło.", 401);
            var result = await signIn.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
            if (result.IsLockedOut) return Error("Logowanie zostało czasowo zablokowane. Spróbuj później lub skontaktuj się z Filharmonią.", 423);
            if (result.IsNotAllowed) return Error("Potwierdź adres e-mail, aby się zalogować.", 403);
            return result.Succeeded ? Results.Ok() : Error("Nieprawidłowy e-mail lub hasło.", 401);
        });
        group.MapPost("/logout", async (SignInManager<ApplicationUser> signIn) => { await signIn.SignOutAsync(); return Results.NoContent(); });

        group.MapPut("/profile", async Task<IResult> (ProfileRequest request, HttpContext http, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn) =>
        {
            var user = (await users.GetUserAsync(http.User))!;
            if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Length > 100 || request.PhoneNumber?.Length > 30 || request.SchoolName?.Length > 200 || request.SchoolAddress?.Length > 300)
                return Error("Sprawdź dane profilu i długość wprowadzonych pól.");
            if (await users.IsInRoleAsync(user, AccountRoles.School) && string.IsNullOrWhiteSpace(request.SchoolName)) return Error("Podaj nazwę szkoły.");
            user.DisplayName = request.DisplayName.Trim();
            user.PhoneNumber = request.PhoneNumber?.Trim();
            if (await users.IsInRoleAsync(user, AccountRoles.School))
            {
                user.SchoolName = request.SchoolName!.Trim();
                user.SchoolAddress = request.SchoolAddress?.Trim() ?? "";
            }
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok(await View(user, users)) : IdentityError(result);
        }).RequireAuthorization();
        group.MapPost("/password", async Task<IResult> (PasswordRequest request, HttpContext http, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn) =>
        {
            var user = (await users.GetUserAsync(http.User))!;
            if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length > 128) return Error("Podaj nowe hasło (maksymalnie 128 znaków).");
            IdentityResult result;
            if (await users.HasPasswordAsync(user)) result = await users.ChangePasswordAsync(user, request.CurrentPassword ?? "", request.NewPassword);
            else
            {
                if (!await RecentLogin(http)) return Error("Zaloguj się ponownie, aby ustawić hasło.", 403);
                result = await users.AddPasswordAsync(user, request.NewPassword);
            }
            if (!result.Succeeded) return IdentityError(result);
            await signIn.RefreshSignInAsync(user);
            return Results.Ok();
        }).RequireAuthorization();
        group.MapPost("/logout-all", async (HttpContext http, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn) =>
        {
            await users.UpdateSecurityStampAsync((await users.GetUserAsync(http.User))!);
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPost("/resend-confirmation", async Task<IResult> (EmailRequest request, UserManager<ApplicationUser> users, AccountEmailSender mail, IConfiguration config) =>
        {
            if (!mail.Available) return Error("Wysyłka e-mail jest chwilowo niedostępna.", 503);
            var user = ValidEmail(request.Email) ? await users.FindByEmailAsync(request.Email.Trim()) : null;
            if (user is not null && !user.EmailConfirmed) await SendConfirmation(user, user.Email!, null, users, mail, config);
            return Results.Ok(new { message = "Jeśli konto wymaga potwierdzenia, wysłaliśmy wiadomość e-mail." });
        });
        group.MapPost("/forgot-password", async Task<IResult> (EmailRequest request, UserManager<ApplicationUser> users, AccountEmailSender mail, IConfiguration config) =>
        {
            if (!mail.Available) return Error("Odzyskiwanie hasła jest chwilowo niedostępne. Skontaktuj się z Filharmonią.", 503);
            var user = ValidEmail(request.Email) ? await users.FindByEmailAsync(request.Email.Trim()) : null;
            if (user is not null && await users.HasPasswordAsync(user))
            {
                var token = Encode(await users.GeneratePasswordResetTokenAsync(user));
                var url = AccountUrl(config) + "?action=reset&email=" + Uri.EscapeDataString(user.Email!) + "&token=" + Uri.EscapeDataString(token);
                await mail.SendAsync(user.Email!, "SymfonIA — nowe hasło", "Aby ustawić nowe hasło, otwórz link (ważny 2 godziny):\n" + url + "\nJeśli nie proszono o zmianę, pomiń tę wiadomość.");
            }
            return Results.Ok(new { message = "Jeśli konto istnieje, wysłaliśmy instrukcję zmiany hasła." });
        });
        group.MapPost("/reset-password", async Task<IResult> (ResetPasswordRequest request, UserManager<ApplicationUser> users) =>
        {
            if (!ValidEmail(request.Email) || string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length > 128) return Error("Sprawdź e-mail i nowe hasło.");
            var user = await users.FindByEmailAsync(request.Email.Trim());
            if (user is null) return Error("Link jest nieprawidłowy lub wygasł.");
            var token = Decode(request.Token);
            if (token is null) return Error("Link jest nieprawidłowy lub wygasł.");
            var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
            return result.Succeeded ? Results.Ok() : IdentityError(result);
        });
        group.MapPost("/email", async Task<IResult> (EmailRequest request, HttpContext http, UserManager<ApplicationUser> users, AccountEmailSender mail, IConfiguration config) =>
        {
            if (!mail.Available) return Error("Wysyłka e-mail jest chwilowo niedostępna.", 503);
            if (!ValidEmail(request.Email)) return Error("Podaj poprawny adres e-mail.");
            var user = (await users.GetUserAsync(http.User))!;
            var newEmail = request.Email.Trim();
            var existing = await users.FindByEmailAsync(newEmail);
            if (existing is not null && existing.Id != user.Id) return Error("Nie można użyć tego adresu e-mail.");
            if (!await RecentLogin(http)) return Error("Zaloguj się ponownie, aby zmienić adres e-mail.", 403);
            await SendConfirmation(user, newEmail, newEmail == user.Email ? null : newEmail, users, mail, config);
            return Results.Ok();
        }).RequireAuthorization();
        group.MapPost("/confirm-email", async Task<IResult> (ConfirmEmailRequest request, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, HttpContext http) =>
        {
            var user = await users.FindByIdAsync(request.UserId);
            var token = Decode(request.Token);
            if (user is null || token is null || request.NewEmail is not null && !ValidEmail(request.NewEmail)) return Error("Link jest nieprawidłowy lub wygasł.");
            var result = request.NewEmail is null ? await users.ConfirmEmailAsync(user, token) : await users.ChangeEmailAsync(user, request.NewEmail, token);
            if (!result.Succeeded) return IdentityError(result);
            if (request.NewEmail is not null)
            {
                // Login names are opaque IDs for social accounts; email-based local names follow the new email.
                result = await users.SetUserNameAsync(user, request.NewEmail);
                if (!result.Succeeded) return IdentityError(result);
                await users.UpdateSecurityStampAsync(user);
            }
            if (users.GetUserId(http.User) == user.Id) await signIn.RefreshSignInAsync(user);
            return Results.Ok();
        });

        group.MapPut("/favorites", async Task<IResult> (FavoriteRequest request, HttpContext http, UserManager<ApplicationUser> users) =>
        {
            if (request.EventIds is null || request.EventIds.Length > 1000 || request.EventIds.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 100)) return Error("Nieprawidłowa lista ulubionych.");
            var user = (await users.GetUserAsync(http.User))!;
            if (request.UserId != user.Id) return Error("Sesja konta zmieniła się. Odśwież stronę.", 409);
            user.FavoriteEventIds = request.EventIds.Distinct().ToArray();
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok() : IdentityError(result);
        }).RequireAuthorization();
        group.MapPut("/favorite-artists", async Task<IResult> (FavoriteArtistsRequest request, HttpContext http, UserManager<ApplicationUser> users) =>
        {
            if (request.ArtistIds is null || request.ArtistIds.Length > 1000 || request.ArtistIds.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 200)) return Error("Nieprawidłowa lista ulubionych artystów.");
            var user = (await users.GetUserAsync(http.User))!;
            if (request.UserId != user.Id) return Error("Sesja konta zmieniła się. Odśwież stronę.", 409);
            user.FavoriteArtistIds = request.ArtistIds.Distinct().ToArray();
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok() : IdentityError(result);
        }).RequireAuthorization();
        group.MapGet("/export", async (HttpContext http, UserManager<ApplicationUser> users) => Results.Json(await View((await users.GetUserAsync(http.User))!, users))).RequireAuthorization();
        group.MapDelete("", async Task<IResult> ([Microsoft.AspNetCore.Mvc.FromBody] DeleteAccountRequest request, HttpContext http, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, ContentDbContext db) =>
        {
            var user = (await users.GetUserAsync(http.User))!;
            if (request.Confirmation != "USUŃ") return Error("Wpisz USUŃ, aby potwierdzić usunięcie konta.");
            if (await users.HasPasswordAsync(user) ? !await users.CheckPasswordAsync(user, request.Password ?? "") : !await RecentLogin(http)) return Error("Potwierdź hasło lub zaloguj się ponownie.", 403);
            await using var transaction = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(2026101801)");
            if (await LastAdmin(user, users)) return Error("Nie można usunąć ostatniego administratora.");
            var result = await users.DeleteAsync(user);
            if (!result.Succeeded) return IdentityError(result);
            await transaction.CommitAsync();
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPost("/external/{provider}", async Task<IResult> (string provider, HttpContext http, SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users, IConfiguration config) =>
        {
            var form = await http.Request.ReadFormAsync();
            var frontend = form["frontend"].ToString().TrimEnd('/');
            if (!allowedOrigins.Contains(frontend, StringComparer.OrdinalIgnoreCase)) return Error("Nieprawidłowy adres powrotu.");
            if (!IdentityConfiguration.Providers.Contains(provider) || !IdentityConfiguration.ProviderConfigured(config, provider)) return Error("Ten sposób logowania jest chwilowo niedostępny.", 503);
            var link = form["link"] == "true";
            var userId = link ? users.GetUserId(http.User) : null;
            if (link && (userId is null || !await RecentLogin(http))) return Results.Redirect(frontend + "/konto?authError=reauthenticate");
            var callback = "/api/account/external/callback?frontend=" + Uri.EscapeDataString(frontend) + (link ? "&link=true" : "");
            var properties = signIn.ConfigureExternalAuthenticationProperties(provider, callback, userId);
            properties.Items["frontend"] = frontend;
            return Results.Challenge(properties, [provider]);
        });
        group.MapGet("/external/callback", async Task<IResult> (string frontend, bool? link, HttpContext http, SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users) =>
        {
            if (!allowedOrigins.Contains(frontend, StringComparer.OrdinalIgnoreCase)) return Error("Nieprawidłowy adres powrotu.");
            IResult Failed(string code) => Results.Redirect(frontend + "/konto?authError=" + code);
            var userId = link == true ? users.GetUserId(http.User) : null;
            if (link == true && userId is null) return Failed("reauthenticate");
            var info = await signIn.GetExternalLoginInfoAsync(userId);
            if (info is null) return Failed("external_failed");
            try
            {
                if (link == true)
                {
                    if (!await RecentLogin(http)) return Failed("reauthenticate");
                    var linkedUser = (await users.GetUserAsync(http.User))!;
                    var added = await users.AddLoginAsync(linkedUser, info);
                    if (!added.Succeeded) return Failed("already_linked");
                    await signIn.RefreshSignInAsync(linkedUser);
                    return Results.Redirect(frontend + "/konto?authSuccess=linked");
                }
                var known = await users.FindByLoginAsync(info.LoginProvider, info.ProviderKey);
                if (known is not null)
                {
                    var signedIn = await signIn.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, false, bypassTwoFactor: false);
                    return signedIn.Succeeded ? Results.Redirect(frontend + "/konto") : Failed("signin_denied");
                }
                var email = info.Principal.FindFirstValue(ClaimTypes.Email) ?? info.Principal.FindFirstValue("email");
                if (!ValidEmail(email)) return Failed("email_missing");
                // Never auto-link by an email claim from a third party.
                if (await users.FindByEmailAsync(email!) is not null) return Failed("existing_account");
                var user = new ApplicationUser { UserName = email, Email = email, DisplayName = (info.Principal.FindFirstValue(ClaimTypes.Name) ?? "Meloman")[..Math.Min((info.Principal.FindFirstValue(ClaimTypes.Name) ?? "Meloman").Length, 100)] };
                var created = await users.CreateAsync(user);
                if (!created.Succeeded) return Failed("external_failed");
                var addedLogin = await users.AddLoginAsync(user, info);
                var role = await users.AddToRoleAsync(user, AccountRoles.User);
                if (!addedLogin.Succeeded || !role.Succeeded) { await users.DeleteAsync(user); return Failed("external_failed"); }
                if (!await signIn.CanSignInAsync(user))
                {
                    var mail = http.RequestServices.GetRequiredService<AccountEmailSender>();
                    if (mail.Available) await SendConfirmation(user, email!, null, users, mail, http.RequestServices.GetRequiredService<IConfiguration>());
                    return Failed("confirm_email");
                }
                await signIn.SignInAsync(user, false, info.LoginProvider);
                return Results.Redirect(frontend + "/konto");
            }
            finally { await http.SignOutAsync(IdentityConstants.ExternalScheme); }
        });
        group.MapDelete("/external/{provider}", async Task<IResult> (string provider, HttpContext http, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn) =>
        {
            var user = (await users.GetUserAsync(http.User))!;
            if (!await RecentLogin(http)) return Error("Zaloguj się ponownie, aby odłączyć konto.", 403);
            var logins = await users.GetLoginsAsync(user);
            var login = logins.FirstOrDefault(item => item.LoginProvider == provider);
            if (login is null) return Error("To konto nie jest podłączone.");
            if (!await users.HasPasswordAsync(user) && logins.Count <= 1) return Error("Najpierw ustaw hasło lub podłącz inny sposób logowania.");
            var result = await users.RemoveLoginAsync(user, provider, login.ProviderKey);
            if (!result.Succeeded) return IdentityError(result);
            await users.UpdateSecurityStampAsync(user);
            await signIn.RefreshSignInAsync(user);
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapGet("/users", async (string? q, int? page, UserManager<ApplicationUser> users) =>
        {
            var query = users.Users.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(q)) query = query.Where(user => user.Email!.Contains(q) || user.DisplayName.Contains(q));
            var total = await query.CountAsync();
            var items = await query.OrderBy(user => user.Email).Skip(Math.Clamp(page ?? 0, 0, 100000) * 25).Take(25).ToArrayAsync();
            var data = new List<object>();
            foreach (var item in items) data.Add(await View(item, users));
            return Results.Ok(new { total, items = data });
        }).RequireAuthorization(policy => policy.RequireRole(AccountRoles.Admin));
        group.MapPut("/users/{id}/role", async Task<IResult> (string id, RoleRequest request, UserManager<ApplicationUser> users, ContentDbContext db) =>
        {
            if (!AccountRoles.All.Contains(request.Role)) return Error("Nieprawidłowy rodzaj konta.");
            await using var transaction = await db.Database.BeginTransactionAsync();
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(2026101801)");
            var user = await users.FindByIdAsync(id);
            if (user is null) return Results.NotFound();
            if (request.Role != AccountRoles.Admin && await LastAdmin(user, users)) return Error("Nie można odebrać uprawnień ostatniemu administratorowi.");
            var oldRoles = await users.GetRolesAsync(user);
            var result = await users.RemoveFromRolesAsync(user, oldRoles);
            if (result.Succeeded) result = await users.AddToRoleAsync(user, request.Role);
            if (!result.Succeeded) return IdentityError(result);
            await users.UpdateSecurityStampAsync(user);
            await transaction.CommitAsync();
            return Results.Ok();
        }).RequireAuthorization(policy => policy.RequireRole(AccountRoles.Admin));
    }

    public static async Task<object> View(ApplicationUser user, UserManager<ApplicationUser> users) => new
    {
        user.Id, user.Email, user.EmailConfirmed, user.DisplayName, user.PhoneNumber, user.SchoolName, user.SchoolAddress,
        user.CreatedAt, user.FavoriteEventIds, user.FavoriteArtistIds,
        roles = await users.GetRolesAsync(user),
        hasPassword = await users.HasPasswordAsync(user),
        logins = (await users.GetLoginsAsync(user)).Select(login => login.LoginProvider)
    };

    private static async Task<bool> LastAdmin(ApplicationUser user, UserManager<ApplicationUser> users) =>
        await users.IsInRoleAsync(user, AccountRoles.Admin) && (await users.GetUsersInRoleAsync(AccountRoles.Admin)).Count <= 1;
    private static async Task<bool> RecentLogin(HttpContext http) =>
        (await http.AuthenticateAsync(IdentityConstants.ApplicationScheme)).Properties?.IssuedUtc is { } issued && issued > DateTimeOffset.UtcNow.AddMinutes(-15);
    private static bool ValidEmail(string? email) => email?.Length <= 254 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email.Trim();
    private static IResult Error(string message, int status = 400) => Results.Json(new { message }, statusCode: status);
    private static IResult IdentityError(IdentityResult result) => Error(result.Errors.Any(error => error.Code.StartsWith("Password"))
        ? "Hasło musi mieć 12–128 znaków, małą i wielką literę oraz cyfrę. Sprawdź także bieżące hasło."
        : result.Errors.Any(error => error.Code.Contains("Duplicate")) ? "Nie można utworzyć konta z tym adresem. Zaloguj się lub odzyskaj hasło."
        : "Nie udało się zapisać zmian. Sprawdź dane lub zaloguj się ponownie.");
    private static string Encode(string value) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(value));
    private static string? Decode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 5000) return null;
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value)); } catch (FormatException) { return null; }
    }
    private static string AccountUrl(IConfiguration config) => (config["Identity:FrontendUrl"] ?? "http://127.0.0.1:4200").TrimEnd('/') + "/konto";
    private static async Task SendConfirmation(ApplicationUser user, string recipient, string? newEmail, UserManager<ApplicationUser> users, AccountEmailSender mail, IConfiguration config)
    {
        var token = newEmail is null ? await users.GenerateEmailConfirmationTokenAsync(user) : await users.GenerateChangeEmailTokenAsync(user, newEmail);
        var url = AccountUrl(config) + "?action=confirm&userId=" + Uri.EscapeDataString(user.Id) + "&token=" + Encode(token)
            + (newEmail is null ? "" : "&newEmail=" + Uri.EscapeDataString(newEmail));
        await mail.SendAsync(recipient, "SymfonIA — potwierdź adres e-mail", "Potwierdź adres e-mail, otwierając link (ważny 2 godziny):\n" + url);
    }
}
