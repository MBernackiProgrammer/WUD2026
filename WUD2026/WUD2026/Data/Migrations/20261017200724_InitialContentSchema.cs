using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WUD2026.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialContentSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ContentRevisions",
                columns: table => new
                {
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Operation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Snapshot = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentRevisions", x => x.Revision);
                });

            migrationBuilder.CreateTable(
                name: "Events",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Subtitle = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Duration = table.Column<int>(type: "integer", nullable: false),
                    Room = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Image = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Mood = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Audience = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Age = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    Program = table.Column<string[]>(type: "text[]", nullable: false),
                    Artists = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PublicationState = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    PublishAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Events", x => x.Id);
                    table.CheckConstraint("CK_Events_Age", "\"Age\" BETWEEN 0 AND 120");
                    table.CheckConstraint("CK_Events_Duration", "\"Duration\" BETWEEN 5 AND 1440");
                    table.CheckConstraint("CK_Events_Price", "\"Price\" >= 0 AND \"Price\" <= 10000");
                    table.CheckConstraint("CK_Events_PublicationState", "\"PublicationState\" IN ('draft','published','scheduled')");
                    table.CheckConstraint("CK_Events_Schedule", "\"PublicationState\" <> 'scheduled' OR \"PublishAt\" IS NOT NULL");
                    table.CheckConstraint("CK_Events_Status", "\"Status\" IN ('available','sold-out','unknown')");
                });

            migrationBuilder.CreateTable(
                name: "SiteState",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    HeroPublishAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteState", x => x.Id);
                    table.CheckConstraint("CK_SiteState_Revision", "\"Revision\" > 0");
                    table.CheckConstraint("CK_SiteState_Singleton", "\"Id\" = 1");
                });

            migrationBuilder.CreateTable(
                name: "HeroVersions",
                columns: table => new
                {
                    Slot = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Eyebrow = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    HighlightedTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ImageAlt = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    PrimaryLabel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    PrimaryHref = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    SecondaryLabel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    SecondaryHref = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    SideText = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Caption = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FeaturedEventId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FeaturedLabel = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroVersions", x => x.Slot);
                    table.CheckConstraint("CK_HeroVersions_Slot", "\"Slot\" IN ('draft','published','scheduled')");
                    table.ForeignKey(
                        name: "FK_HeroVersions_Events_FeaturedEventId",
                        column: x => x.FeaturedEventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentRevisions_CreatedAt",
                table: "ContentRevisions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Events_Category_Date",
                table: "Events",
                columns: new[] { "Category", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_Events_Date_Time",
                table: "Events",
                columns: new[] { "Date", "Time" });

            migrationBuilder.CreateIndex(
                name: "IX_Events_PublicationState_PublishAt",
                table: "Events",
                columns: new[] { "PublicationState", "PublishAt" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroVersions_FeaturedEventId",
                table: "HeroVersions",
                column: "FeaturedEventId");

            migrationBuilder.CreateIndex(
                name: "IX_SiteState_HeroPublishAt",
                table: "SiteState",
                column: "HeroPublishAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentRevisions");

            migrationBuilder.DropTable(
                name: "HeroVersions");

            migrationBuilder.DropTable(
                name: "SiteState");

            migrationBuilder.DropTable(
                name: "Events");
        }
    }
}
