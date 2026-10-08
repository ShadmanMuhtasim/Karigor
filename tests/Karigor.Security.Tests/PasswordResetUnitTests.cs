using Karigor.Api.Email;

namespace Karigor.Security.Tests;

[Trait("Layer", "Unit"), Trait("Classification", "GreenBaseline")]
public sealed class PasswordResetUnitTests
{
    [Fact]
    public void QueueBoundsAndNormalizesPerAddressCooldown()
    {
        using var queue = new PasswordResetEmailQueue();
        queue.Enqueue(" Person@example.com "); queue.Enqueue("person@EXAMPLE.com");
        queue.Enqueue("invalid"); queue.Enqueue(null);
        Assert.True(queue.Reader.TryRead(out var email)); Assert.Equal("Person@example.com", email);
        Assert.False(queue.Reader.TryRead(out _));
        for (var i = 0; i < 200; i++) queue.Enqueue($"person{i}@example.com");
        var count = 0;
        while (queue.Reader.TryRead(out _)) count++;
        Assert.Equal(100, count);
    }

    [Theory]
    [InlineData("http://evil.example"), InlineData("https://user:password@example.com"), InlineData("https://example.com/?next=evil")]
    public void EmailLinkRejectsUnsafeOrigins(string origin) =>
        Assert.Throws<InvalidOperationException>(() => PasswordResetEmailWorker.BuildLink(origin, "person@example.com", "token"));
}
