namespace WUD2026.Services;

/// <summary>Schedules live in PostgreSQL; this worker can safely run on every API instance.</summary>
public sealed class PublicationWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<PublicationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Clamp(
            configuration.GetValue("Content:PublicationIntervalSeconds", 1), 1, 300)));
        try
        {
            do
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    await scope.ServiceProvider.GetRequiredService<IContentStore>().PublishDueAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception error)
                {
                    logger.LogError(error, "Publication check failed. Persisted schedules will be retried.");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
