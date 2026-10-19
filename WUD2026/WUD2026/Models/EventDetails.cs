using System.ComponentModel.DataAnnotations;

namespace WUD2026.Models;

// Editorial data travels with the event and is versioned in the same transaction.
public sealed record EventDetails
{
    public string Type { get; init; } = "concert";
    public string? EndDate { get; init; }
    [Range(0, 180)] public int? IntermissionMinutes { get; init; }
    [Range(0, 10000)] public decimal? PriceMax { get; init; }
    [Range(0, 120)] public int? AgeMax { get; init; }
    [StringLength(1500)] public string? WhyAttend { get; init; }
    public string[] Accessibility { get; init; } = [];
    [StringLength(3000)] public string? AccessibilityNotes { get; init; }
    [StringLength(2000)] public string? SensoryNotes { get; init; }
    [StringLength(2048)] public string? ProgramUrl { get; init; }
    public bool Promoted { get; init; }
    [Range(0, 100)] public int PromotionPriority { get; init; }
    public VenueDetails? Venue { get; init; }
    public CollectionDetails? Collection { get; init; }
    public ExhibitionDetails? Exhibition { get; init; }
    public EducationDetails? Education { get; init; }
    public ArtistDetails[] Performers { get; init; } = [];
    public WorkDetails[] Works { get; init; } = [];
    public ArticleDetails[] Articles { get; init; } = [];
    public FaqDetails[] Faqs { get; init; } = [];
}
public sealed record ArtistDetails
{
    [Required, StringLength(100)] public string Id { get; init; } = "";
    [Required, StringLength(200)] public string Name { get; init; } = "";
    [StringLength(200)] public string? Role { get; init; }
    [StringLength(5000)] public string? Biography { get; init; }
    [StringLength(2048)] public string? PhotoUrl { get; init; }
}
public sealed record VenueDetails
{
    [StringLength(200)] public string? Name { get; init; }
    [StringLength(80)] public string? Number { get; init; }
    [StringLength(500)] public string? Address { get; init; }
    [StringLength(1500)] public string? Directions { get; init; }
    [StringLength(2048)] public string? PlanUrl { get; init; }
    [StringLength(2000)] public string? Accessibility { get; init; }
}
public sealed record CollectionDetails
{
    [StringLength(200)] public string? Name { get; init; }
    [StringLength(80)] public string? Season { get; init; }
    [StringLength(3000)] public string? Description { get; init; }
    [StringLength(1500)] public string? Passes { get; init; }
    [StringLength(2048)] public string? PassUrl { get; init; }
}
public sealed record ExhibitionDetails
{
    [StringLength(200)] public string? Title { get; init; }
    [StringLength(200)] public string? Gallery { get; init; }
    [StringLength(1000)] public string? Artists { get; init; }
    [StringLength(200)] public string? Curator { get; init; }
    public string? OpeningAt { get; init; }
    public string[] Photos { get; init; } = [];
}
public sealed record EducationDetails
{
    [StringLength(200)] public string? Group { get; init; }
    [StringLength(200)] public string? Age { get; init; }
    [StringLength(1500)] public string? Registration { get; init; }
    [StringLength(2048)] public string? RegistrationUrl { get; init; }
    [StringLength(2000)] public string? Benefits { get; init; }
}
public sealed record WorkDetails
{
    [Required, StringLength(500)] public string Title { get; init; } = "";
    [StringLength(200)] public string? Composer { get; init; }
    [Range(1, 1440)] public int? Duration { get; init; }
    [StringLength(2048)] public string? AudioUrl { get; init; }
}
public sealed record ArticleDetails
{
    [Required, StringLength(100)] public string Id { get; init; } = "";
    [Required, StringLength(250)] public string Title { get; init; } = "";
    [StringLength(20000)] public string? Text { get; init; }
    public string? Date { get; init; }
    public string[] Media { get; init; } = [];
    public string[] Tags { get; init; } = [];
}
public sealed record FaqDetails
{
    [Required, StringLength(500)] public string Question { get; init; } = "";
    [Required, StringLength(3000)] public string Answer { get; init; } = "";
    [StringLength(100)] public string? Category { get; init; }
}
