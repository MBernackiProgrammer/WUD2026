namespace WUD2026.Data;

public sealed class SiteState
{
    public int Id { get; set; } = 1;
    public long Revision { get; set; } = 1;
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? HeroPublishAt { get; set; }
}

public sealed class HeroVersion
{
    public string Slot { get; set; } = "";
    public string Eyebrow { get; set; } = "";
    public string Title { get; set; } = "";
    public string HighlightedTitle { get; set; } = "";
    public string Description { get; set; } = "";
    public string ImageUrl { get; set; } = "";
    public string ImageAlt { get; set; } = "";
    public string PrimaryLabel { get; set; } = "";
    public string PrimaryHref { get; set; } = "";
    public string SecondaryLabel { get; set; } = "";
    public string SecondaryHref { get; set; } = "";
    public string SideText { get; set; } = "";
    public string Caption { get; set; } = "";
    public string FeaturedEventId { get; set; } = "";
    public string FeaturedLabel { get; set; } = "";
}

public sealed class ContentEvent
{
    public string DetailsJson { get; set; } = "{}";
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public string Category { get; set; } = "";
    public string[] Tags { get; set; } = [];
    public DateOnly Date { get; set; } = default;
    public TimeOnly Time { get; set; } = default;
    public int? Duration { get; set; }
    public string Room { get; set; } = "";
    public decimal? Price { get; set; }
    public string? SourceUrl { get; set; }
    public string? TicketUrl { get; set; }
    public string Image { get; set; } = "";
    public string Mood { get; set; } = "";
    public string Audience { get; set; } = "";
    public int Age { get; set; } = 0;
    public string Description { get; set; } = "";
    public string[] Program { get; set; } = [];
    public string Artists { get; set; } = "";
    public string Status { get; set; } = "unknown";
    public string PublicationState { get; set; } = "draft";
    public DateTimeOffset? PublishAt { get; set; } = null;
}

public sealed class ContentRevision
{
    public long Revision { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string Operation { get; set; } = "";
    public string Snapshot { get; set; } = "";
}
