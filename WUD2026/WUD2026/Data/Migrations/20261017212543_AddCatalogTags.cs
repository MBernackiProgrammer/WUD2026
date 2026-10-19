using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "Tags",
                table: "Events",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);

            // Classify existing rows once. Subsequent editorial tags are authoritative.
            migrationBuilder.Sql("""
                UPDATE "Events" SET "Tags" = ARRAY[
                    CASE
                        WHEN "Subtitle" ILIKE 'Warsztat%' OR "Category" IN ('Zwiedzanie', 'Wystawy') THEN 'events'
                        WHEN "Category" IN ('Symfoniczne', 'Kameralne', 'Jazz', 'Filmowe', 'Recitale', 'Muzyka świata', 'Koncerty zewnętrzne', 'Dla rodzin') THEN 'repertoire'
                        WHEN "Subtitle" ILIKE 'Koncert%' OR "Subtitle" ILIKE 'Recital%' OR "Subtitle" ILIKE 'Spektakl muzyczny%' THEN 'repertoire'
                        ELSE 'events'
                    END
                ]::text[];
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Events");
        }
    }
}
