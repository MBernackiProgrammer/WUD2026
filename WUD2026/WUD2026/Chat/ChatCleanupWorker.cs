using Microsoft.EntityFrameworkCore;
using WUD2026.Data;

namespace WUD2026.Chat;

public sealed class ChatCleanupWorker(IDbContextFactory<ContentDbContext> factory, TimeProvider clock,
    ILogger<ChatCleanupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        try
        {
            do
            {
                try
                {
                    await using var db = await factory.CreateDbContextAsync(stoppingToken);
                    var now = clock.GetUtcNow();
                    await db.ChatSessions.Where(x => x.ExpiresAt <= now && (x.LeaseUntil == null || x.LeaseUntil <= now))
                        .ExecuteDeleteAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception error) { logger.LogError(error, "Expired chat cleanup will be retried."); }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
