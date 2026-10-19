using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using WUD2026.Chat;
using WUD2026.Models;

namespace WUD2026.IntegrationTests;

public sealed class EventCalendarTests
{
    [Fact]
    public void UnknownDurationDoesNotInventAnEndTime()
    {
        var item = Event("2026-12-10") with { Duration = null };
        Assert.DoesNotContain("DTEND:", EventCalendar.Ics(item, DateTimeOffset.UtcNow));
        var query = QueryHelpers.ParseQuery(new Uri(EventCalendar.GoogleUrl(item)).Query);
        Assert.Equal("20261210T180000Z/20261210T180000Z", query["dates"]);
    }
    private static EventContent Event(string date) => new()
    {
        Id = "koncert",
        Title = "Muzyka, światło; sztuka",
        Date = date,
        Time = "19:00",
        Duration = 90,
        Room = "Sala",
        Description = "Linia 1\nBEGIN:VEVENT\nLinia 2"
    };

    [Theory]
    [InlineData("2026-07-10", "20260710T170000Z/20260710T183000Z")]
    [InlineData("2026-12-10", "20261210T180000Z/20261210T193000Z")]
    public void GoogleUsesCorrectUtcTimeForWarsawAndKeepsTitle(string date, string times)
    {
        var url = new Uri(EventCalendar.GoogleUrl(Event(date)));
        var query = QueryHelpers.ParseQuery(url.Query);
        Assert.Equal("calendar.google.com", url.Host);
        Assert.Equal(times, query["dates"]);
        Assert.Equal("Europe/Warsaw", query["ctz"]);
        Assert.Equal(Event(date).Title, query["text"]);
    }

    [Fact]
    public void IcsEscapesInjectionAndFoldsLongUnicodeLinesWithoutBreakingCharacters()
    {
        var item = Event("2026-12-10") with { Title = string.Concat(Enumerable.Repeat("Zażółć, gęślą; ", 20)) };
        var ics = EventCalendar.Ics(item, DateTimeOffset.UtcNow);
        Assert.Contains("DTSTART:20261210T180000Z", ics);
        Assert.Contains("DTEND:20261210T193000Z", ics);
        Assert.Contains("\\nBEGIN:VEVENT\\n", ics);
        Assert.Equal(1, ics.Split("\r\n").Count(x => x == "BEGIN:VEVENT"));
        Assert.All(ics.Split("\r\n"), line => Assert.True(Encoding.UTF8.GetByteCount(line) <= 75));
        Assert.DoesNotContain('\uFFFD', ics);
    }
}
