using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WUD2026.Models;
using WUD2026.Services;

namespace WUD2026.IntegrationTests;

public sealed class CatalogTagsTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Theory]
    [InlineData("Zwiedzanie", "Zwiedzanie", "events")]
    [InlineData("Wystawy", "Wernisaż", "events")]
    [InlineData("Dla rodzin", "Warsztaty dla dzieci od 1. do 2. roku życia", "events")]
    [InlineData("Dla rodzin", "Koncert dla dzieci", "repertoire")]
    [InlineData("Dla rodzin", "Spektakl muzyczny", "repertoire")]
    [InlineData("Inne", "Koncert szkolny", "repertoire")]
    [InlineData("Inne", "Wykład", "events")]
    [InlineData("Jazz", "Improwizacja", "repertoire")]
    public void InitialClassificationSeparatesPerformancesAndOtherActivities(string category, string subtitle, string tag)
    {
        var item = new EventContent { Category = category, Subtitle = subtitle };
        Assert.Equal(tag, EventTags.Classify(item));
        Assert.Equal([tag], EventTags.Normalize(item).Tags);
    }

    [Fact]
    public async Task ExistingRowsAreBackfilledInOneEventsTable()
    {
        var database = await postgres.CreateDatabaseAsync(initialize: false);
        await using var db = await database.Factory.CreateDbContextAsync();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261017210147_ExpandOfficialArtists");
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "Events" ("Id", "Title", "Subtitle", "Category", "Date", "Time", "Duration", "Room", "Price", "Image", "Mood", "Audience", "Age", "Description", "Program", "Artists", "Status", "PublicationState")
            VALUES
            ('tour', 'Tour', 'Zwiedzanie', 'Zwiedzanie', '2026-11-01', '12:00', 60, 'Foyer', 20, 'building-3.jpg', 'Odkrywanie', 'Wszyscy', 0, 'Opis', ARRAY[]::text[], 'Przewodnik', 'unknown', 'published'),
            ('workshop', 'Workshop', 'Warsztaty dla dzieci', 'Dla rodzin', '2026-11-01', '12:00', 60, 'Foyer', 20, 'building-3.jpg', 'Odkrywanie', 'Rodziny', 1, 'Opis', ARRAY[]::text[], 'Animator', 'unknown', 'published'),
            ('concert', 'Concert', 'Koncert dla dzieci', 'Dla rodzin', '2026-11-01', '12:00', 60, 'Foyer', 20, 'building-3.jpg', 'Odkrywanie', 'Rodziny', 5, 'Opis', ARRAY[]::text[], 'Muzycy', 'unknown', 'published');
            """);
        await migrator.MigrateAsync();
        var rows = await db.Events.AsNoTracking().ToDictionaryAsync(e => e.Id);
        Assert.Equal(["events"], rows["tour"].Tags);
        Assert.Equal(["events"], rows["workshop"].Tags);
        Assert.Equal(["repertoire"], rows["concert"].Tags);
    }

    [Fact]
    public async Task EditorialTagOverridesClassificationAndRoundtripsWithoutLosingOtherTags()
    {
        var database = await postgres.CreateDatabaseAsync();
        var document = await database.Store.ReadAsync(default);
        var tour = document.Events.First(e => e.Category == "Zwiedzanie");
        var selected = tour with { Tags = ["repertoire", "specjalne"] };
        ContentValidation.ValidateEvent(selected);
        Assert.Same(selected, EventTags.Normalize(selected));
        await database.Store.UpdateAsync(document.Revision, data => data.Events[data.Events.FindIndex(e => e.Id == tour.Id)] = selected, "test.tags");
        var saved = (await database.Store.ReadAsync(default)).Events.Single(e => e.Id == tour.Id);
        Assert.Equal(selected.Tags, saved.Tags);
        Assert.Equal("Zwiedzanie", saved.Category);
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(tour with { Tags = ["repertoire", "events"] }));
        Assert.Throws<ContentValidationException>(() => ContentValidation.ValidateEvent(tour with { Tags = ["specjalne"] }));
    }
}
