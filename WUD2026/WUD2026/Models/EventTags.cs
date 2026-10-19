namespace WUD2026.Models;

/// <summary>Exactly one catalog tag; other editorial tags may coexist in the same Events row.</summary>
public static class EventTags
{
    public const string Repertoire = "repertoire";
    public const string Events = "events";

    public static string Classify(EventContent item)
    {
        if (item.Subtitle.StartsWith("Warsztat", StringComparison.OrdinalIgnoreCase)
            || item.Category is "Zwiedzanie" or "Wystawy") return Events;
        if (item.Category is "Symfoniczne" or "Kameralne" or "Jazz" or "Filmowe" or "Recitale"
            or "Muzyka świata" or "Koncerty zewnętrzne" or "Dla rodzin") return Repertoire;
        return item.Subtitle.StartsWith("Koncert", StringComparison.OrdinalIgnoreCase)
            || item.Subtitle.StartsWith("Recital", StringComparison.OrdinalIgnoreCase)
            || item.Subtitle.StartsWith("Spektakl muzyczny", StringComparison.OrdinalIgnoreCase)
                ? Repertoire : Events;
    }

    // Compatibility with seed files and clients created before catalog tags existed.
    public static EventContent Normalize(EventContent item) => item.Tags is { Length: 0 }
        ? item with { Tags = [Classify(item)] } : item;
}
