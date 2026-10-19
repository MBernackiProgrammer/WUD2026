using System.Collections;
using System.Globalization;
using WUD2026.Models;

namespace WUD2026.Services;

public static partial class ContentValidation
{
    private static void ValidateDetails(EventContent item)
    {
        var d = item.Details ?? throw new ContentValidationException("Brak szczegółów wydarzenia.");
        if (d.Type is not ("concert" or "cycle" or "festival" or "exhibition" or "education" or "tour" or "other"))
            throw new ContentValidationException("Nieznany typ wydarzenia.");
        if (d.PriceMax.HasValue && (!item.Price.HasValue || d.PriceMax < item.Price))
            throw new ContentValidationException("Cena maksymalna wymaga ceny od i nie może być od niej niższa.");
        if (d.AgeMax < item.Age) throw new ContentValidationException("Wiek maksymalny nie może być niższy od minimalnego.");
        if (d.EndDate is not null && (!DateOnly.TryParseExact(d.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) || string.CompareOrdinal(d.EndDate, item.Date) < 0))
            throw new ContentValidationException("Data zakończenia musi być poprawna i nie wcześniejsza niż początek.");
        if (d.Exhibition?.OpeningAt is { } opening && !DateTime.TryParseExact(opening, "yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new ContentValidationException("Podaj datę i godzinę wernisażu.");
        ValidateTree(d);
        if (d.Performers.Select(x => x.Id).Distinct().Count() != d.Performers.Length || d.Articles.Select(x => x.Id).Distinct().Count() != d.Articles.Length)
            throw new ContentValidationException("Identyfikatory artystów i artykułów muszą być unikalne w wydarzeniu.");
        foreach (var id in d.Performers.Select(x => x.Id).Concat(d.Articles.Select(x => x.Id)))
            if (!EventId().IsMatch(id)) throw new ContentValidationException("Niepoprawny identyfikator profilu lub artykułu.");
        if (d.Accessibility.Any(x => x is not ("mobility" or "visual" or "hearing" or "sensory")))
            throw new ContentValidationException("Nieznana kategoria dostępności.");
        foreach (var article in d.Articles)
            if (article.Date is not null && !DateOnly.TryParseExact(article.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                throw new ContentValidationException("Niepoprawna data artykułu.");
    }

    private static void ValidateTree(object value)
    {
        ValidateAnnotations(value);
        foreach (var property in value.GetType().GetProperties())
        {
            var entry = property.GetValue(value);
            if (entry is null)
            {
                if (property.PropertyType.IsArray) throw new ContentValidationException("Lista nie może być null: " + property.Name);
                continue;
            }
            if (entry is string text)
            {
                if (property.Name.EndsWith("Url", StringComparison.Ordinal) && !SafeResource(text))
                    throw new ContentValidationException("Podaj adres HTTPS lub ścieżkę /images/ albo /files/: " + property.Name);
            }
            else if (entry is IEnumerable list)
            {
                var items = list.Cast<object?>().ToArray();
                if (items.Length > 50) throw new ContentValidationException("Lista może mieć najwyżej 50 pozycji.");
                foreach (var element in items)
                {
                    if (element is null) throw new ContentValidationException("Lista zawiera pustą pozycję.");
                    if (element is string item)
                    {
                        if (string.IsNullOrWhiteSpace(item) || item.Length > 2048) throw new ContentValidationException("Niepoprawna pozycja listy.");
                        if (property.Name is "Photos" or "Media" && !SafeResource(item)) throw new ContentValidationException("Niepoprawny adres medium.");
                    }
                    else ValidateTree(element);
                }
            }
            else if (entry.GetType().Namespace == typeof(EventDetails).Namespace) ValidateTree(entry);
        }
    }

    private static bool SafeResource(string value) =>
        !value.Any(char.IsWhiteSpace) && !value.Contains('\\') && !value.Contains("..") &&
        ((value.StartsWith("/images/", StringComparison.Ordinal) || value.StartsWith("/files/", StringComparison.Ordinal))
        || Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && string.IsNullOrEmpty(uri.UserInfo) && uri.IsWellFormedOriginalString());
}
