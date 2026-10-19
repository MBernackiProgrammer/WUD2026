using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;
using WUD2026.Models;

namespace WUD2026.Services;

public sealed class ContentValidationException(string message) : Exception(message);
public sealed class ContentConflictException() : Exception("Treść została zmieniona. Odśwież dane przed kolejnym zapisem.");

public static partial class ContentValidation
{
    public static void ValidateHero(HeroContent? hero, ContentDocument document)
    {
        if (hero is null) throw new ContentValidationException("Brak danych hero.");
        ValidateAnnotations(hero);
        if (!IsImageUrl(hero.ImageUrl)) throw new ContentValidationException("Zdjęcie musi wskazywać plik /images/ lub adres HTTPS.");
        if (!IsInternalPath(hero.PrimaryHref) || !IsInternalPath(hero.SecondaryHref))
            throw new ContentValidationException("Przyciski muszą prowadzić do ścieżki w serwisie, np. /repertuar.");
        if (!document.Events.Any(item => item.Id == hero.FeaturedEventId))
            throw new ContentValidationException("Wybierz istniejące promowane wydarzenie.");
    }

    public static void ValidateEvent(EventContent? item)
    {
        if (item is null) throw new ContentValidationException("Brak danych wydarzenia.");
        ValidateAnnotations(item);
        ValidateDetails(item);
        if (item.Tags is null || item.Tags.Length > 20 || item.Tags.Any(tag => string.IsNullOrWhiteSpace(tag) || tag.Length > 60)
            || item.Tags.Distinct().Count() != item.Tags.Length
            || item.Tags.Length > 0 && item.Tags.Count(tag => tag is EventTags.Repertoire or EventTags.Events) != 1)
            throw new ContentValidationException("Wybierz dokładnie jedną zakładkę: Repertuar lub Wydarzenia.");
        if (item.SourceUrl is not null && (!Uri.TryCreate(item.SourceUrl, UriKind.Absolute, out var source)
            || source.Scheme != "https" || !string.IsNullOrEmpty(source.UserInfo)))
            throw new ContentValidationException("Źródło wydarzenia musi być adresem HTTPS.");
        if (!EventId().IsMatch(item.Id)) throw new ContentValidationException("Identyfikator może zawierać małe litery, cyfry i myślniki.");
        if (!DateOnly.TryParseExact(item.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            || !TimeOnly.TryParseExact(item.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new ContentValidationException("Podaj poprawną datę i godzinę wydarzenia.");
        if (item.PublicationState is not ("draft" or "published" or "scheduled"))
            throw new ContentValidationException("Nieznany stan publikacji.");
        if (item.PublicationState == "scheduled" && item.PublishAt is null)
            throw new ContentValidationException("Zaplanowane wydarzenie wymaga terminu publikacji.");
        if (item.Status is not ("available" or "last-tickets" or "sold-out" or "unknown"))
            throw new ContentValidationException("Nieznany status biletów.");
        if (item.TicketUrl is not null && (!Uri.TryCreate(item.TicketUrl, UriKind.Absolute, out var ticketUrl)
            || ticketUrl.Scheme != Uri.UriSchemeHttps || string.IsNullOrEmpty(ticketUrl.Host)
            || !string.IsNullOrEmpty(ticketUrl.UserInfo) || !ticketUrl.IsWellFormedOriginalString()
            || item.TicketUrl.Any(char.IsWhiteSpace) || item.TicketUrl.Contains('\\')))
            throw new ContentValidationException("Link do sprzedawcy biletów musi być pełnym adresem HTTPS, bez danych logowania.");
        if (!ImageFile().IsMatch(item.Image)) throw new ContentValidationException("Wybierz plik zdjęcia z biblioteki.");
        if (item.Program is null || item.Program.Length > 50 || item.Program.Any(line => line is null || line.Length > 1000))
            throw new ContentValidationException("Program może zawierać do 50 pozycji po 1000 znaków.");
    }

    public static bool IsPublished(EventContent item, DateTimeOffset now) =>
        item.PublicationState == "published" || item.PublicationState == "scheduled" && item.PublishAt <= now;

    private static bool IsInternalPath(string value) => value.StartsWith('/') && !value.StartsWith("//") && !value.Contains('\\') && !value.Any(char.IsControl);
    private static bool IsImageUrl(string value) =>
        value.StartsWith("/images/") && !value.Contains("..") && !value.Contains('\\') && !value.Any(char.IsControl)
        || Uri.TryCreate(value, UriKind.Absolute, out var url) && url.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(url.UserInfo);

    private static void ValidateAnnotations(object value)
    {
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), errors, true))
            throw new ContentValidationException("Uzupełnij wymagane pola i sprawdź długość tekstów: " + string.Join("; ", errors.Select(error => error.MemberNames.FirstOrDefault())));
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")] private static partial Regex EventId();
    [GeneratedRegex("^[a-zA-Z0-9_-]+\\.(jpg|jpeg|png|webp)$")] private static partial Regex ImageFile();
}
