using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WUD2026.Models;
using WUD2026.Services;
using WUD2026.Chat;

namespace WUD2026.IntegrationTests;

public sealed class EventDetailsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task DetailsRoundTripAndRemainInRevisionAndOneEventsTable()
    {
        var database = await postgres.CreateDatabaseAsync();
        var before = await database.Store.ReadAsync();
        var item = before.Events[0] with {
            Status = "last-tickets",
            Details = new EventDetails {
                Type = "festival", IntermissionMinutes = 20, PriceMax = 200,
                WhyAttend = "Bliskość orkiestry pozwala usłyszeć każdą barwę.",
                Venue = new VenueDetails { Name = "Sala", Address = "Szczecin", PlanUrl = "https://example.org/plan.pdf" },
                Collection = new CollectionDetails { Name = "Festiwal", Season = "2026/27", Passes = "Karnet trzydniowy", PassUrl = "https://example.org/karnet" },
                Performers = [new ArtistDetails { Id = "anna-nowak", Name = "Anna Nowak", Role = "skrzypce", Biography = "Biogram", PhotoUrl = "/images/anna.jpg" }],
                Works = [new WorkDetails { Title = "Koncert", Composer = "Kompozytor", Duration = 30, AudioUrl = "https://example.org/audio.mp3" }],
                Articles = [new ArticleDetails { Id = "poznaj-program", Title = "Poznaj program", Text = "Artykuł", Date = "2026-10-18", Media = ["/images/anna.jpg"], Tags = ["muzyka"] }],
                Faqs = [new FaqDetails { Question = "Czy jest przerwa?", Answer = "Tak, dwadzieścia minut.", Category = "Wizyta" }],
                Accessibility = ["mobility"], SensoryNotes = "Bez efektów świetlnych", Promoted = true, PromotionPriority = 10,
                ProgramUrl = "https://example.org/program.pdf"
            }
        };
        ContentValidation.ValidateEvent(item);
        await database.Store.UpdateAsync(before.Revision, doc => doc.Events[0] = item);
        var after = await database.Store.ReadAsync();
        var saved = after.Events.Single(e => e.Id == item.Id);
        Assert.Equal(JsonSerializer.Serialize(item.Details), JsonSerializer.Serialize(saved.Details));
        Assert.Equal("last-tickets", saved.Status);
        await using var db = await database.Factory.CreateDbContextAsync();
        Assert.Equal(before.Events.Count, await db.Events.CountAsync());
        var snapshot = await db.Revisions.SingleAsync(x => x.Revision == after.Revision);
        Assert.Contains("anna-nowak", snapshot.Snapshot);
    }

    [Fact]
    public async Task RejectsInvalidNestedContentBeforeWriting()
    {
        var database = await postgres.CreateDatabaseAsync();
        var doc = await database.Store.ReadAsync(); var item = doc.Events[0];
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(item with { Details = new() { PriceMax = 1 } }));
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(item with { Details = new() { EndDate = "2020-01-01" } }));
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(item with { Details = new() { Works = [new() {Title="Utwór", AudioUrl="javascript:alert(1)"}] } }));
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(item with { Details = new() { Faqs = [new() {Question="Pytanie"}] } }));
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(item with { Details = new() { Performers = null! } }));
        Assert.Equal(doc.Revision, (await database.Store.ReadAsync()).Revision);
    }

    [Fact]
    public void ExhibitionCalendarKeepsVenueAndEndDateAcrossDst()
    {
        var item = new EventContent { Id="wystawa", Date="2026-10-24", Time="12:00", Details=new() {EndDate="2026-10-26",Venue=new(){Name="Galeria",Address="Inny adres"}} };
        var ics = EventCalendar.Ics(item, DateTimeOffset.UtcNow);
        Assert.Contains("DTEND:20261026T225900Z", ics);
        Assert.Contains("Galeria\\, Inny adres", ics);
    }
}
