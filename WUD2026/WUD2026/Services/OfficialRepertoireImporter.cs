using System.Text.Json;
using WUD2026.Models;

namespace WUD2026.Services;

/// <summary>Explicit local CLI import; one validated content transaction, never an automatic startup sync.</summary>
public static class OfficialRepertoireImporter
{
    public static async Task ImportAsync(string path, IContentStore store, ILogger logger, CancellationToken token = default)
    {
        await using var stream = File.OpenRead(path);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: token);
        if (json.RootElement.GetProperty("source").GetString() != "https://filharmonia.szczecin.pl/repertuar")
            throw new InvalidDataException("Nieznane źródło importu.");
        var events = (json.RootElement.GetProperty("events").Deserialize<EventContent[]>(DatabaseContentStore.JsonOptions)
            ?? throw new InvalidDataException("Brak wydarzeń w imporcie.")).Select(EventTags.Normalize).ToArray();
        if (events.Length == 0 || events.Length > 5000 || events.Select(e => e.Id).Distinct().Count() != events.Length)
            throw new InvalidDataException("Pusty import lub powtórzone identyfikatory.");
        foreach (var item in events)
        {
            ContentValidation.ValidateEvent(item);
            if (!item.Id.StartsWith("fs-") || item.SourceUrl is null || new Uri(item.SourceUrl).Host != "filharmonia.szczecin.pl"
                || item.PublicationState != "published")
                throw new InvalidDataException("Nieprawidłowa tożsamość źródła: " + item.Id);
        }
        var current = await store.ReadAsync(token);
        var known = current.Events.ToDictionary(e => e.Id);
        // Legacy imports must not erase extended editorial data.
        events = events.Select(e => known.TryGetValue(e.Id, out var old) ? e with { Details = old.Details } : e).ToArray();
        // Record equality compares decimal values regardless of PostgreSQL's numeric scale.
        // Arrays need sequence comparison instead of reference equality.
        var changed = events.Where(e => !known.TryGetValue(e.Id, out var old)
            || (e with { Program = old.Program, Tags = old.Tags, Details = old.Details }) != old
            || !e.Program.SequenceEqual(old.Program) || !e.Tags.SequenceEqual(old.Tags)).ToArray();
        if (changed.Length == 0)
        {
            logger.LogInformation("Official repertoire unchanged: {Events} terms. No revision written.", events.Length);
            return;
        }
        var added = changed.Count(e => !known.ContainsKey(e.Id));
        var result = await store.UpdateAsync(current.Revision, document =>
        {
            foreach (var item in changed)
            {
                var index = document.Events.FindIndex(e => e.Id == item.Id);
                if (index < 0) document.Events.Add(item);
                else document.Events[index] = item;
            }
        }, operation: "repertoire.official-import", cancellationToken: token);
        logger.LogInformation("Official repertoire imported: {Added} added, {Updated} updated, {Unchanged} unchanged; revision {Revision}. Existing unrelated content preserved.",
            added, changed.Length - added, events.Length - changed.Length, result.Revision);
    }
}
