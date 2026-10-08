using System.Collections.Concurrent;
using Karigor.Api.Email;

namespace Karigor.Security.Tests.Infrastructure;

public sealed class FakePasswordResetEmailSender : IPasswordResetEmailSender
{
    private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> messages = new(StringComparer.OrdinalIgnoreCase);
    private TaskCompletionSource<string> Message(string email) => messages.GetOrAdd(email,
        _ => new(TaskCreationOptions.RunContinuationsAsynchronously));
    public Task SendAsync(string email, string link, CancellationToken cancellation)
    {
        Message(email).TrySetResult(link);
        return Task.CompletedTask;
    }
    public Task<string> WaitAsync(string email) => Message(email).Task.WaitAsync(TimeSpan.FromSeconds(15));
}
