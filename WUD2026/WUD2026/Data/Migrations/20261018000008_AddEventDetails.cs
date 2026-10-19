using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEventDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_Status",
                table: "Events");

            migrationBuilder.AddColumn<string>(
                name: "Details",
                table: "Events",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_Status",
                table: "Events",
                sql: "\"Status\" IN ('available','last-tickets','sold-out','unknown')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_Status",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "Details",
                table: "Events");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_Status",
                table: "Events",
                sql: "\"Status\" IN ('available','sold-out','unknown')");
        }
    }
}
