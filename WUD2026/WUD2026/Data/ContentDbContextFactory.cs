using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace WUD2026.Data;
/// <summary>Migration tooling only reads environment configuration and never starts the host.</summary>
public sealed class ContentDbContextFactory : IDesignTimeDbContextFactory<ContentDbContext>
{
    public ContentDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        return new ContentDbContext(new DbContextOptionsBuilder<ContentDbContext>()
            .UseNpgsql(DatabaseConnection.FromConfiguration(configuration)).Options);
    }
}
