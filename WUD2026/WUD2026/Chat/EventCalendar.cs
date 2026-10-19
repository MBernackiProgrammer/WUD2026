using System.Globalization;
using System.Text;
using WUD2026.Models;

namespace WUD2026.Chat;

public static class EventCalendar
{
    private static readonly TimeZoneInfo Warsaw = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    public static DateTimeOffset Start(EventContent item)
    {
        var local = DateTime.ParseExact(item.Date + " " + item.Time, "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        if (Warsaw.IsInvalidTime(local)) throw new ChatException(422, "Termin wydarzenia wymaga korekty strefy czasowej.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), Warsaw));
    }

    public static string GoogleUrl(EventContent item)
    {
        var start = Start(item);
        var values = new Dictionary<string, string>
        {
            ["action"] = "TEMPLATE",
            ["text"] = item.Title,
            ["dates"] = Stamp(start) + "/" + Stamp(End(item) ?? start),
            ["ctz"] = "Europe/Warsaw",
            ["location"] = Location(item),
            ["details"] = item.Subtitle + "\n" + item.Description
        };
        return "https://calendar.google.com/calendar/render?" + string.Join("&", values.Select(x =>
            Uri.EscapeDataString(x.Key) + "=" + Uri.EscapeDataString(x.Value)));
    }

    public static string Ics(EventContent item, DateTimeOffset now)
    {
        var start = Start(item);
        var lines = new[] {
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Filharmonia Szczecin//Kalendarz//PL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
            "BEGIN:VEVENT", "UID:" + item.Id + "@filharmonia.szczecin.pl", "DTSTAMP:" + Stamp(now),
            "DTSTART:" + Stamp(start),
            End(item) is { } end ? "DTEND:" + Stamp(end) : null,
            "SUMMARY:" + Escape(item.Title), "LOCATION:" + Escape(Location(item)),
            "DESCRIPTION:" + Escape(item.Subtitle + "\n" + item.Description), "END:VEVENT", "END:VCALENDAR"
        };
        return string.Join("\r\n", lines.Where(line => line is not null).Select(line => Fold(line!))) + "\r\n";
    }

    private static string Location(EventContent item) => (item.Details.Venue?.Name ?? item.Room) + ", " + (item.Details.Venue?.Address ?? "Filharmonia w Szczecinie, ul. Małopolska 48");
    private static DateTimeOffset? End(EventContent item) => item.Details.EndDate is { } date
        ? Start(item with { Date = date, Time = "23:59" })
        : item.Duration is { } duration ? Start(item).AddMinutes(duration) : null;
    private static string Stamp(DateTimeOffset date) => date.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
    private static string Escape(string value) => value.Replace("\\", "\\\\").Replace("\r\n", "\n").Replace("\r", "\n")
        .Replace("\n", "\\n").Replace(";", "\\;").Replace(",", "\\,");
    private static string Fold(string line)
    {
        var output = new StringBuilder();
        var bytes = 0;
        foreach (var rune in line.EnumerateRunes())
        {
            var count = rune.Utf8SequenceLength;
            if (bytes + count > 75) { output.Append("\r\n "); bytes = 1; }
            output.Append(rune.ToString());
            bytes += count;
        }
        return output.ToString();
    }
}
