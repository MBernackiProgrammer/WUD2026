using System.Globalization;
using System.Text.Json;
using WUD2026.Models;

namespace WUD2026.Data;

internal static class ContentMapping
{
    public static HeroContent ToContent(HeroVersion entity) => new()
    {
        Eyebrow = entity.Eyebrow,
        Title = entity.Title,
        HighlightedTitle = entity.HighlightedTitle,
        Description = entity.Description,
        ImageUrl = entity.ImageUrl,
        ImageAlt = entity.ImageAlt,
        PrimaryLabel = entity.PrimaryLabel,
        PrimaryHref = entity.PrimaryHref,
        SecondaryLabel = entity.SecondaryLabel,
        SecondaryHref = entity.SecondaryHref,
        SideText = entity.SideText,
        Caption = entity.Caption,
        FeaturedEventId = entity.FeaturedEventId,
        FeaturedLabel = entity.FeaturedLabel,
    };

    public static HeroVersion ToEntity(string slot, HeroContent content) => new()
    {
        Slot = slot,
        Eyebrow = content.Eyebrow,
        Title = content.Title,
        HighlightedTitle = content.HighlightedTitle,
        Description = content.Description,
        ImageUrl = content.ImageUrl,
        ImageAlt = content.ImageAlt,
        PrimaryLabel = content.PrimaryLabel,
        PrimaryHref = content.PrimaryHref,
        SecondaryLabel = content.SecondaryLabel,
        SecondaryHref = content.SecondaryHref,
        SideText = content.SideText,
        Caption = content.Caption,
        FeaturedEventId = content.FeaturedEventId,
        FeaturedLabel = content.FeaturedLabel,
    };

    public static EventContent ToContent(ContentEvent entity) => new()
    {
        Details = entity.DetailsJson.Trim() == "{}" ? new EventDetails { Type = entity.Category == "Wystawy" ? "exhibition" : entity.Category == "Zwiedzanie" ? "tour" : entity.Subtitle.StartsWith("Warsztat", StringComparison.OrdinalIgnoreCase) ? "education" : "concert" }
            : JsonSerializer.Deserialize<EventDetails>(entity.DetailsJson, WUD2026.Services.DatabaseContentStore.JsonOptions) ?? new(),
        Id = entity.Id,
        Title = entity.Title,
        Subtitle = entity.Subtitle,
        Category = entity.Category,
        Tags = entity.Tags,
        Date = entity.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        Time = entity.Time.ToString("HH:mm", CultureInfo.InvariantCulture),
        Duration = entity.Duration,
        Room = entity.Room,
        Price = entity.Price,
        TicketUrl = entity.TicketUrl,
        SourceUrl = entity.SourceUrl,
        Image = entity.Image,
        Mood = entity.Mood,
        Audience = entity.Audience,
        Age = entity.Age,
        Description = entity.Description,
        Program = entity.Program,
        Artists = entity.Artists,
        Status = entity.Status,
        PublicationState = entity.PublicationState,
        PublishAt = entity.PublishAt,
    };

    public static ContentEvent ToEntity(EventContent content) => new()
    {
        DetailsJson = JsonSerializer.Serialize(content.Details, WUD2026.Services.DatabaseContentStore.JsonOptions),
        Id = content.Id,
        Title = content.Title,
        Subtitle = content.Subtitle,
        Category = content.Category,
        Tags = EventTags.Normalize(content).Tags,
        Date = DateOnly.ParseExact(content.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture),
        Time = TimeOnly.ParseExact(content.Time, "HH:mm", CultureInfo.InvariantCulture),
        Duration = content.Duration,
        Room = content.Room,
        Price = content.Price,
        TicketUrl = content.TicketUrl,
        SourceUrl = content.SourceUrl,
        Image = content.Image,
        Mood = content.Mood,
        Audience = content.Audience,
        Age = content.Age,
        Description = content.Description,
        Program = content.Program,
        Artists = content.Artists,
        Status = content.Status,
        PublicationState = content.PublicationState,
        PublishAt = content.PublishAt?.ToUniversalTime(),
    };
}
