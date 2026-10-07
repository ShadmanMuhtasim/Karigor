using Karigor.Application.Payments.SslCommerz;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Karigor.Security.Tests;

[Trait("Layer", "Unit"), Trait("Finding", "F1"), Trait("Classification", "GreenBaseline")]
public sealed class SslCommerzClientSecurityTests
{
    [Theory]
    [InlineData("initiation"), InlineData("validation")]
    public async Task SandboxCredentialErrorNeverSwitchesMerchant(string operation)
    {
        using var handler = new FakePaymentHandler();
        using var http = new HttpClient(handler);
        var options = Options.Create(new SslCommerzOptions
        { StoreId = "configured-fixture", StorePassword = "fixture-password", IsSandbox = true });
        var client = new SslCommerzClient(http, options, NullLogger<SslCommerzClient>.Instance);
        const string error = "{\"status\":\"FAILED\",\"failedreason\":\"Store Credential Error Or Store is De-active\"}";
        if (operation == "initiation")
        {
            handler.SetInitResponse(error);
            await Assert.ThrowsAsync<InvalidOperationException>(() => client.InitiateTransactionAsync(
                "fixture-transaction", 1000, 60, 1, 2, 3, "Fixture", "fixture@security.invalid", "01700000000", "Fixture", "Service"));
            Assert.Contains("store_id=configured-fixture", handler.LastRequestBody!);
            Assert.DoesNotContain("testbox", handler.LastRequestBody!);
        }
        else
        {
            handler.SetResponse(error);
            Assert.Equal("FAILED", (await client.ValidateTransactionAsync("fixture-validation")).Status);
            Assert.Contains("store_id=configured-fixture", handler.LastRequestUri!.Query);
            Assert.DoesNotContain("testbox", handler.LastRequestUri.Query);
        }
        Assert.Equal("sandbox.sslcommerz.com", handler.LastRequestUri!.Host);
        Assert.Equal(1, handler.Calls); Assert.Equal(0, handler.UnexpectedCalls);
    }
}
