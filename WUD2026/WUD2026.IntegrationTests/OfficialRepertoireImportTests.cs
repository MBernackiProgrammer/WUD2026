using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using WUD2026.Models;
using WUD2026.Services;

namespace WUD2026.IntegrationTests;

public sealed class OfficialRepertoireImportTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task OfficialImportIsAtomicRepeatableAndPreservesUnknownFactsAndUnrelatedEvents()
    {
        var database = await postgres.CreateDatabaseAsync();
        var original = await database.Store.ReadAsync(default);
        var imported = original.Events[0] with
        {
            Id = "fs-12345",
            SourceUrl = "https://filharmonia.szczecin.pl/wydarzenia/12345-koncert",
            Duration = null,
            Price = null,
            PublicationState = "published",
            Artists = new string('A', 600)
        };
        var path = Path.GetTempFileName();
        try
        {
            await Write(path, [imported]);
            await OfficialRepertoireImporter.ImportAsync(path, database.Store, NullLogger.Instance);
            var first = await database.Store.ReadAsync(default);
            Assert.Equal(original.Revision + 1, first.Revision);
            Assert.Equal(original.Events.Count + 1, first.Events.Count);
            var saved = first.Events.Single(e => e.Id == imported.Id);
            Assert.Null(saved.Price); Assert.Null(saved.Duration); Assert.Equal(imported.SourceUrl, saved.SourceUrl);
            Assert.Equal(imported.Artists, saved.Artists);
            await OfficialRepertoireImporter.ImportAsync(path, database.Store, NullLogger.Instance);
            Assert.Equal(first.Revision, (await database.Store.ReadAsync(default)).Revision);
            await Write(path, [imported with { Price = 70 }]);
            await OfficialRepertoireImporter.ImportAsync(path, database.Store, NullLogger.Instance);
            var updated = await database.Store.ReadAsync(default);
            Assert.Equal(first.Revision + 1, updated.Revision);
            Assert.Equal(first.Events.Count, updated.Events.Count);
            Assert.Equal(70, updated.Events.Single(e => e.Id == imported.Id).Price);
            await OfficialRepertoireImporter.ImportAsync(path, database.Store, NullLogger.Instance);
            Assert.Equal(updated.Revision, (await database.Store.ReadAsync(default)).Revision);
            Assert.All(original.Events, old => Assert.Contains(updated.Events, e => e.Id == old.Id));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public async Task InvalidImportDoesNotPartiallyWriteValidEntries()
    {
        var database = await postgres.CreateDatabaseAsync();
        var original = await database.Store.ReadAsync(default);
        var valid = original.Events[0] with { Id = "fs-12345", SourceUrl = "https://filharmonia.szczecin.pl/wydarzenia/12345", PublicationState = "published" };
        var path = Path.GetTempFileName();
        try
        {
            await Write(path, [valid, valid with { Id = "fs-12346", SourceUrl = "https://example.org/untrusted" }]);
            await Assert.ThrowsAsync<InvalidDataException>(() => OfficialRepertoireImporter.ImportAsync(path, database.Store, NullLogger.Instance));
            var result = await database.Store.ReadAsync(default);
            Assert.Equal(original.Revision, result.Revision);
            Assert.Equal(original.Events.Count, result.Events.Count);
        }
        finally { File.Delete(path); }
    }

    private static Task Write(string path, EventContent[] events) => File.WriteAllTextAsync(path,
        JsonSerializer.Serialize(new { source = "https://filharmonia.szczecin.pl/repertuar", events }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
}
