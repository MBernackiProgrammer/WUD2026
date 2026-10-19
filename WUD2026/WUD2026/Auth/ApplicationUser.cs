using Microsoft.AspNetCore.Identity;

namespace WUD2026.Auth;

public sealed class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public string SchoolName { get; set; } = "";
    public string SchoolAddress { get; set; } = "";
    public string[] FavoriteEventIds { get; set; } = [];
    public string[] FavoriteArtistIds { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class AccountRoles
{
    public const string User = "User";
    public const string Admin = "Admin";
    public const string School = "School";
    public static readonly string[] All = [User, Admin, School];
}

public sealed record RegisterRequest(string Email, string Password, string DisplayName, string AccountType, string? SchoolName);
public sealed record LoginRequest(string Email, string Password, bool RememberMe);
public sealed record ProfileRequest(string DisplayName, string? PhoneNumber, string? SchoolName, string? SchoolAddress);
public sealed record PasswordRequest(string? CurrentPassword, string NewPassword);
public sealed record EmailRequest(string Email);
public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);
public sealed record ConfirmEmailRequest(string UserId, string Token, string? NewEmail);
public sealed record DeleteAccountRequest(string? Password, string Confirmation);
public sealed record RoleRequest(string Role);
public sealed record FavoriteRequest(string[] EventIds, string UserId);

public sealed record FavoriteArtistsRequest(string[] ArtistIds, string UserId);
