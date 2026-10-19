using Microsoft.EntityFrameworkCore;
using WUD2026.Chat;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using WUD2026.Auth;

namespace WUD2026.Data;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<SiteState> SiteStates => Set<SiteState>();
    public DbSet<HeroVersion> HeroVersions => Set<HeroVersion>();
    public DbSet<ContentEvent> Events => Set<ContentEvent>();
    public DbSet<ContentRevision> Revisions => Set<ContentRevision>();

    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
    public DbSet<ChatTurn> ChatTurns => Set<ChatTurn>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        base.OnModelCreating(model);
        model.Entity<ApplicationUser>().Property(x => x.DisplayName).HasMaxLength(100);
        model.Entity<ApplicationUser>().Property(x => x.SchoolName).HasMaxLength(200);
        model.Entity<ApplicationUser>().Property(x => x.SchoolAddress).HasMaxLength(300);
        model.Entity<ApplicationUser>().Property(x => x.FavoriteEventIds).HasColumnType("text[]");
        model.Entity<ApplicationUser>().Property(x => x.FavoriteArtistIds).HasColumnType("text[]");
        var sessions = model.Entity<ChatSession>();
        sessions.ToTable("ChatSessions");
        sessions.HasKey(x => x.Id);
        sessions.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        sessions.Property(x => x.Memory).HasMaxLength(4000).IsRequired();
        sessions.HasIndex(x => x.ExpiresAt);
        var turns = model.Entity<ChatTurn>();
        turns.ToTable("ChatTurns");
        turns.HasKey(x => new { x.SessionId, x.RequestId });
        turns.HasIndex(x => new { x.SessionId, x.Number }).IsUnique();
        turns.HasOne<ChatSession>().WithMany().HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        turns.Property(x => x.Question).HasMaxLength(2000).IsRequired();
        turns.Property(x => x.Reply).HasMaxLength(8000).IsRequired();
        turns.Property(x => x.Recommendations).HasColumnType("jsonb").IsRequired();
        turns.Property(x => x.FollowUps).HasColumnType("text[]").IsRequired();
        var state = model.Entity<SiteState>();
        state.ToTable("SiteState", table =>
        {
            table.HasCheckConstraint("CK_SiteState_Singleton", "\"Id\" = 1");
            table.HasCheckConstraint("CK_SiteState_Revision", "\"Revision\" > 0");
        });
        state.HasKey(x => x.Id);
        state.Property(x => x.Id).ValueGeneratedNever();
        state.Property(x => x.Revision).IsConcurrencyToken();

        var hero = model.Entity<HeroVersion>();
        hero.ToTable("HeroVersions", table => table.HasCheckConstraint("CK_HeroVersions_Slot", "\"Slot\" IN ('draft','published','scheduled')"));
        hero.HasKey(x => x.Slot);
        hero.Property(x => x.Slot).HasMaxLength(16);
        hero.Property(x => x.Eyebrow).HasMaxLength(120).IsRequired();
        hero.Property(x => x.Title).HasMaxLength(100).IsRequired();
        hero.Property(x => x.HighlightedTitle).HasMaxLength(100).IsRequired();
        hero.Property(x => x.Description).HasMaxLength(500).IsRequired();
        hero.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
        hero.Property(x => x.ImageAlt).HasMaxLength(250).IsRequired();
        hero.Property(x => x.PrimaryLabel).HasMaxLength(60).IsRequired();
        hero.Property(x => x.PrimaryHref).HasMaxLength(250).IsRequired();
        hero.Property(x => x.SecondaryLabel).HasMaxLength(60).IsRequired();
        hero.Property(x => x.SecondaryHref).HasMaxLength(250).IsRequired();
        hero.Property(x => x.SideText).HasMaxLength(120).IsRequired();
        hero.Property(x => x.Caption).HasMaxLength(120).IsRequired();
        hero.Property(x => x.FeaturedEventId).HasMaxLength(100).IsRequired();
        hero.Property(x => x.FeaturedLabel).HasMaxLength(100).IsRequired();
        hero.HasOne<ContentEvent>().WithMany().HasForeignKey(x => x.FeaturedEventId).OnDelete(DeleteBehavior.Restrict);

        var events = model.Entity<ContentEvent>();
        events.ToTable("Events", table =>
        {
            table.HasCheckConstraint("CK_Events_PublicationState", "\"PublicationState\" IN ('draft','published','scheduled')");
            table.HasCheckConstraint("CK_Events_Status", "\"Status\" IN ('available','last-tickets','sold-out','unknown')");
            table.HasCheckConstraint("CK_Events_Schedule", "\"PublicationState\" <> 'scheduled' OR \"PublishAt\" IS NOT NULL");
            table.HasCheckConstraint("CK_Events_Price", "\"Price\" >= 0 AND \"Price\" <= 10000");
            table.HasCheckConstraint("CK_Events_Duration", "\"Duration\" BETWEEN 5 AND 1440");
            table.HasCheckConstraint("CK_Events_Age", "\"Age\" BETWEEN 0 AND 120");
        });
        events.HasKey(x => x.Id);
        events.Property(x => x.DetailsJson).HasColumnName("Details").HasColumnType("jsonb").HasDefaultValue("{}").IsRequired();
        events.Property(x => x.Id).HasMaxLength(100).IsRequired();
        events.Property(x => x.Title).HasMaxLength(150).IsRequired();
        events.Property(x => x.Subtitle).HasMaxLength(250).IsRequired();
        events.Property(x => x.Category).HasMaxLength(80).IsRequired();
        events.Property(x => x.Room).HasMaxLength(150).IsRequired();
        events.Property(x => x.Image).HasMaxLength(200).IsRequired();
        events.Property(x => x.Mood).HasMaxLength(80).IsRequired();
        events.Property(x => x.Audience).HasMaxLength(80).IsRequired();
        events.Property(x => x.Description).HasMaxLength(5000).IsRequired();
        events.Property(x => x.Artists).HasMaxLength(2000).IsRequired();
        events.Property(x => x.Status).HasMaxLength(16).IsRequired();
        events.Property(x => x.PublicationState).HasMaxLength(16).IsRequired();
        events.Property(x => x.Price).HasPrecision(10, 2);
        events.Property(x => x.TicketUrl).HasMaxLength(2048);
        events.Property(x => x.SourceUrl).HasMaxLength(2048);
        events.Property(x => x.Program).HasColumnType("text[]").IsRequired();
        events.Property(x => x.Tags).HasColumnType("text[]").IsRequired();
        events.HasIndex(x => new { x.Date, x.Time });
        events.HasIndex(x => new { x.Category, x.Date });
        events.HasIndex(x => new { x.PublicationState, x.PublishAt });
        state.HasIndex(x => x.HeroPublishAt);

        var revisions = model.Entity<ContentRevision>();
        revisions.ToTable("ContentRevisions");
        revisions.HasKey(x => x.Revision);
        revisions.Property(x => x.Revision).ValueGeneratedNever();
        revisions.Property(x => x.Operation).HasMaxLength(80).IsRequired();
        revisions.Property(x => x.Snapshot).HasColumnType("jsonb").IsRequired();
        revisions.HasIndex(x => x.CreatedAt);
    }
}
