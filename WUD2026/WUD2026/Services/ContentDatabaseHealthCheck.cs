using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using WUD2026.Data;

namespace WUD2026.Services;

public sealed class ContentDatabaseHealthCheck(IDbContextFactory<ContentDbContext> factory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var db = await factory.CreateDbContextAsync(cancellationToken);
            return await db.SiteStates.AnyAsync(x => x.Id == 1, cancellationToken)
                ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("Content is not initialized.");
        }
        catch (Exception) { return HealthCheckResult.Unhealthy("Content database is unavailable."); }
    }
}
