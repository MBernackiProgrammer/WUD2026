using WUD2026.Models;

namespace WUD2026.Services;

public interface IContentStore
{
    Task<ContentDocument> ReadAsync(CancellationToken cancellationToken = default);
    Task<ContentDocument> UpdateAsync(long expectedRevision, Action<ContentDocument> update,
        string operation = "content.update", CancellationToken cancellationToken = default);
    Task PublishDueAsync(CancellationToken cancellationToken = default);
}
