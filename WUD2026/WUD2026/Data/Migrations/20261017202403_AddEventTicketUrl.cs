using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventTicketUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TicketUrl",
                table: "Events",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TicketUrl",
                table: "Events");
        }
    }
}
