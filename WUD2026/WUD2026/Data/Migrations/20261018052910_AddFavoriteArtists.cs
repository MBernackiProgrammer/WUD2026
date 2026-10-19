using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFavoriteArtists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "FavoriteArtistIds",
                table: "AspNetUsers",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FavoriteArtistIds",
                table: "AspNetUsers");
        }
    }
}
