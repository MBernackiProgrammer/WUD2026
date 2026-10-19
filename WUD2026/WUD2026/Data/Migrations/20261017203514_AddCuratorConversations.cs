using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCuratorConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Memory = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Turn = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LeaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChatTurns",
                columns: table => new
                {
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Question = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Reply = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    Recommendations = table.Column<string>(type: "jsonb", nullable: false),
                    FollowUps = table.Column<string[]>(type: "text[]", nullable: false),
                    CatalogRevision = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatTurns", x => new { x.SessionId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_ChatTurns_ChatSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "ChatSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatSessions_ExpiresAt",
                table: "ChatSessions",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ChatTurns_SessionId_Number",
                table: "ChatTurns",
                columns: new[] { "SessionId", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatTurns");

            migrationBuilder.DropTable(
                name: "ChatSessions");
        }
    }
}
