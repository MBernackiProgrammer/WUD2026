using Npgsql;
using WUD2026.Chat;

namespace WUD2026.Services;

public sealed class ContentExceptionMiddleware(RequestDelegate next, ILogger<ContentExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.CacheControl = "no-store";
        try { await next(context); }
        catch (ChatException error)
        {
            await WriteAsync(context, error.Status, error.Message);
        }
        catch (ContentValidationException error)
        {
            await WriteAsync(context, StatusCodes.Status400BadRequest, error.Message);
        }
        catch (ContentConflictException error)
        {
            await WriteAsync(context, StatusCodes.Status409Conflict, error.Message);
        }
        catch (Exception error) when (IsDatabaseFailure(error))
        {
            // Npgsql's non-retrying execution strategy may wrap connection errors in InvalidOperationException.
            logger.LogError(error, "Content database operation failed for {Path}", context.Request.Path);
            await WriteAsync(context, StatusCodes.Status503ServiceUnavailable,
                "Baza danych jest chwilowo niedostępna. Spróbuj ponownie.");
        }
    }

    private static bool IsDatabaseFailure(Exception error)
    {
        for (Exception? current = error; current is not null; current = current.InnerException)
            if (current is NpgsqlException) return true;
        return false;
    }

    private static Task WriteAsync(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new { message }, context.RequestAborted);
    }
}
