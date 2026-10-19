using System.ComponentModel.DataAnnotations;

namespace WUD2026.Models;

public sealed record HeroContent
{
    [Required, StringLength(120)] public string Eyebrow { get; init; } = "";
    [Required, StringLength(100)] public string Title { get; init; } = "";
    [Required, StringLength(100)] public string HighlightedTitle { get; init; } = "";
    [Required, StringLength(500)] public string Description { get; init; } = "";
    [Required, StringLength(1000)] public string ImageUrl { get; init; } = "";
    [Required, StringLength(250)] public string ImageAlt { get; init; } = "";
    [Required, StringLength(60)] public string PrimaryLabel { get; init; } = "";
    [Required, StringLength(250)] public string PrimaryHref { get; init; } = "";
    [Required, StringLength(60)] public string SecondaryLabel { get; init; } = "";
    [Required, StringLength(250)] public string SecondaryHref { get; init; } = "";
    [Required, StringLength(120)] public string SideText { get; init; } = "";
    [Required, StringLength(120)] public string Caption { get; init; } = "";
    [Required, StringLength(120)] public string FeaturedEventId { get; init; } = "";
    [Required, StringLength(100)] public string FeaturedLabel { get; init; } = "";
}

public sealed record EventContent
{
    public EventDetails Details { get; init; } = new();
    [Required, StringLength(100)] public string Id { get; init; } = "";
    [Required, StringLength(150)] public string Title { get; init; } = "";
    [Required, StringLength(250)] public string Subtitle { get; init; } = "";
    [Required, StringLength(80)] public string Category { get; init; } = "";
    public string[] Tags { get; init; } = [];
    [Required] public string Date { get; init; } = "";
    [Required] public string Time { get; init; } = "";
    [Range(5, 1440)] public int? Duration { get; init; }
    [Required, StringLength(150)] public string Room { get; init; } = "";
    [Range(0, 10000)] public decimal? Price { get; init; }
    [StringLength(2048)] public string? SourceUrl { get; init; }
    [StringLength(2048)] public string? TicketUrl { get; init; }
    [Required, StringLength(200)] public string Image { get; init; } = "";
    [Required, StringLength(80)] public string Mood { get; init; } = "";
    [Required, StringLength(80)] public string Audience { get; init; } = "";
    [Range(0, 120)] public int Age { get; init; }
    [Required, StringLength(5000)] public string Description { get; init; } = "";
    public string[] Program { get; init; } = [];
    [Required, StringLength(2000)] public string Artists { get; init; } = "";
    [Required] public string Status { get; init; } = "unknown";
    [Required] public string PublicationState { get; init; } = "draft";
    public DateTimeOffset? PublishAt { get; init; }
}

public sealed class ContentDocument
{
    public long Revision { get; set; } = 1;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public HeroContent DraftHero { get; set; } = new();
    public HeroContent PublishedHero { get; set; } = new();
    public HeroContent? ScheduledHero { get; set; }
    public DateTimeOffset? HeroPublishAt { get; set; }
    public List<EventContent> Events { get; set; } = [];
}

public sealed record SaveHeroRequest(long Revision, HeroContent? Hero);
public sealed record PublishHeroRequest(long Revision, DateTimeOffset? PublishAt);
public sealed record SaveEventRequest(long Revision, EventContent? Event);
public sealed record HomePageResponse(HeroContent Hero, EventContent? FeaturedEvent, long Revision, DateTimeOffset UpdatedAt);
