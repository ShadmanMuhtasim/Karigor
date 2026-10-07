using System.Net;
using System.Text.Json;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Finding", "F1")]
public sealed class PaymentSecurityTests(SecurityApplicationFixture fixture)
{
    private async Task<(int Id, string Transaction, Scenario Scenario)> AttemptAsync()
    {
        fixture.Provider.Reset();
        var scenario = await fixture.SeedAsync("Completed", booking: true);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var payment = new Payment
        {
            BookingId = scenario.BookingId!.Value, TransactionId = "fixture_" + Guid.NewGuid().ToString("N")[..20],
            TotalAmount = 1000, PlatformFee = 20, ServiceCharge = 40, WorkerAmount = 940, Status = "Initiated"
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return (payment.Id, payment.TransactionId, scenario);
    }

    private async Task<Payment> CallbackAsync(int id, string transaction, string? validationId)
    {
        using var client = fixture.Client();
        var fields = new Dictionary<string, string> { ["tran_id"] = transaction, ["status"] = "VALID" };
        if (validationId is not null) fields["val_id"] = validationId;
        using var response = await client.PostAsync("/api/payments/sslcommerz/success", new FormUrlEncodedContent(fields));
        Assert.True(response.IsSuccessStatusCode || response.StatusCode is HttpStatusCode.BadRequest
            or HttpStatusCode.Forbidden or HttpStatusCode.UnprocessableEntity or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.Found or HttpStatusCode.SeeOther,
            $"Unexpected callback response: {response.StatusCode}. A 500/setup error is not an expected security assertion.");
        Assert.Equal(0, fixture.Provider.UnexpectedCalls); // A provider-fixture error must not become an accepted known failure.
        using var scope = fixture.Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<KarigorDbContext>().Payments.AsNoTracking()
            .Include(p => p.Booking).SingleAsync(p => p.Id == id);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task CallerValidStatusAloneCannotSettlePayment()
    {
        var attempt = await AttemptAsync();
        var payment = await CallbackAsync(attempt.Id, attempt.Transaction, validationId: null);
        Assert.Equal(0, fixture.Provider.Calls);
        Assert.True(payment.Status != "Completed" && payment.Booking.PaymentStatus != "Paid",
            "F1_CALLER_STATUS: caller VALID without provider verification must not settle payment.");
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task UnavailableProviderCannotFallBackToCallerValid()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetUnavailable();
        var payment = await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        Assert.Equal(1, fixture.Provider.Calls);
        Assert.True(payment.Status != "Completed" && payment.Booking.PaymentStatus != "Paid",
            "F1_PROVIDER_UNAVAILABLE: provider failure must not grant payment success from caller VALID.");
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task ReceiptForAnotherTransactionCannotSettlePayment()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt("another-transaction");
        var payment = await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        Assert.Equal(1, fixture.Provider.Calls);
        Assert.True(payment.Status != "Completed" && payment.Booking.PaymentStatus != "Paid",
            "F1_TRANSACTION_BINDING: a receipt for another transaction must not settle this attempt.");
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task ReceiptWithWrongCurrencyCannotSettlePayment()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction, "USD");
        var payment = await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        Assert.Equal(1, fixture.Provider.Calls);
        Assert.True(payment.Status != "Completed" && payment.Booking.PaymentStatus != "Paid",
            "F1_CURRENCY_BINDING: a USD receipt must not settle the stored BDT attempt.");
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task MatchingProviderReceiptUpdatesPaymentAndBooking()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        var payment = await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        Assert.Equal(1, fixture.Provider.Calls);
        Assert.Equal("Completed", payment.Status);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal("Paid", (await db.Bookings.FindAsync(payment.BookingId))!.PaymentStatus);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task SqlServerRejectsDuplicatePaymentTransaction()
    {
        var attempt = await AttemptAsync();
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal("Microsoft.EntityFrameworkCore.SqlServer", db.Database.ProviderName);
        var existing = await db.Payments.AsNoTracking().SingleAsync(p => p.Id == attempt.Id);
        db.Payments.Add(new Payment
        {
            BookingId = existing.BookingId, TransactionId = existing.TransactionId, Status = "Initiated",
            TotalAmount = existing.TotalAmount, PlatformFee = existing.PlatformFee,
            ServiceCharge = existing.ServiceCharge, WorkerAmount = existing.WorkerAmount, Currency = existing.Currency
        });
        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        var sql = Assert.IsType<Microsoft.Data.SqlClient.SqlException>(error.InnerException);
        Assert.Contains(sql.Number, new[] { 2601, 2627 }); // SQL uniqueness violations, not any database failure.
    }

    private static string Receipt(string transaction, string? field = null, string? value = null)
    {
        var receipt = new Dictionary<string, string?>
        {
            ["status"] = "VALID", ["tran_id"] = transaction, ["val_id"] = "fixture-validation",
            ["amount"] = "1000.00", ["currency"] = "BDT", ["bank_tran_id"] = "provider-bank", ["card_type"] = "provider-card"
        };
        if (field is not null) receipt[field] = value;
        return JsonSerializer.Serialize(receipt);
    }

    private async Task<(HttpStatusCode Status, string Body, bool Retry)> PostAsync(string route, Dictionary<string, string> fields)
    {
        using var client = fixture.Client();
        using var response = await client.PostAsync("/api/payments/sslcommerz/" + route, new FormUrlEncodedContent(fields));
        Assert.Equal(0, fixture.Provider.UnexpectedCalls);
        return (response.StatusCode, await response.Content.ReadAsStringAsync(), response.Headers.RetryAfter is not null);
    }

    private static Dictionary<string, string> Fields(string transaction) => new()
    { ["tran_id"] = transaction, ["status"] = "VALID", ["val_id"] = "fixture-validation" };

    private async Task<Payment> ReloadAsync(int id)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<KarigorDbContext>().Payments.AsNoTracking()
            .Include(p => p.Booking).SingleAsync(p => p.Id == id);
    }

    private async Task AssertUnresolvedAsync(int id)
    {
        var payment = await ReloadAsync(id);
        Assert.Equal("Initiated", payment.Status);
        Assert.Equal("Unpaid", payment.Booking.PaymentStatus);
        Assert.Null(payment.PaidAt);
        Assert.Null(payment.ValId);
        Assert.Null(payment.BankTranId);
        Assert.Null(payment.CardType);
        Assert.Null(payment.GatewayResponse);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("fail"), InlineData("cancel"), InlineData("ipn")]
    public async Task UntrustedCallbackRoutesLeavePaymentUnresolved(string route)
    {
        var attempt = await AttemptAsync();
        var fields = Fields(attempt.Transaction);
        fields.Remove("val_id");
        var result = await PostAsync(route, fields);
        Assert.Equal(route == "ipn" ? HttpStatusCode.UnprocessableEntity : HttpStatusCode.OK, result.Status);
        Assert.Equal(0, fixture.Provider.Calls);
        if (route != "ipn") Assert.Contains("Payment Not Confirmed", result.Body);
        await AssertUnresolvedAsync(attempt.Id);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("success"), InlineData("fail"), InlineData("cancel")]
    public async Task BrowserGetCallbackRequiresTheSameProviderVerification(string route)
    {
        var attempt = await AttemptAsync();
        using var client = fixture.Client();
        var url = $"/api/payments/sslcommerz/{route}?tran_id={attempt.Transaction}";
        using var unverified = await client.GetAsync(url + "&status=VALID");
        Assert.Equal(HttpStatusCode.OK, unverified.StatusCode);
        Assert.Contains("Payment Not Confirmed", await unverified.Content.ReadAsStringAsync());
        Assert.Equal(0, fixture.Provider.Calls);
        await AssertUnresolvedAsync(attempt.Id);
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        using var verified = await client.GetAsync(url + "&status=FAILED&val_id=fixture-validation");
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        Assert.Equal(1, fixture.Provider.Calls); Assert.Equal(0, fixture.Provider.UnexpectedCalls);
        Assert.Contains("Payment Confirmed", await verified.Content.ReadAsStringAsync());
        var payment = await ReloadAsync(attempt.Id);
        Assert.Equal("Completed", payment.Status); Assert.Equal("Paid", payment.Booking.PaymentStatus);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("success", "unknown"), InlineData("fail", "unknown"), InlineData("cancel", "unknown"), InlineData("ipn", "unknown")]
    [InlineData("success", "case"), InlineData("success", "space")]
    public async Task UnknownOrNonExactTransactionCannotUseBookingFallback(string route, string kind)
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        var transaction = kind switch { "case" => attempt.Transaction.ToUpperInvariant(), "space" => attempt.Transaction + " ", _ => "unknown" };
        var fields = Fields(transaction);
        fields["value_a"] = attempt.Scenario.BookingId!.Value.ToString();
        var result = await PostAsync(route, fields);
        Assert.Equal(route == "ipn" ? HttpStatusCode.NotFound : HttpStatusCode.OK, result.Status);
        Assert.Equal(0, fixture.Provider.Calls);
        await AssertUnresolvedAsync(attempt.Id);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("amount", null), InlineData("amount", ""), InlineData("amount", "invalid")]
    [InlineData("amount", "999.99"), InlineData("amount", "1000.01")]
    [InlineData("amount", "1,000.00"), InlineData("amount", "1e3"), InlineData("amount", "1000.0000000000000000000000000001")]
    [InlineData("tran_id", null), InlineData("currency", null), InlineData("val_id", null), InlineData("val_id", "another-validation")]
    [InlineData("status", "FAILED"), InlineData("status", "INVALID_TRANSACTION")]
    public async Task MalformedOrUnboundProviderReceiptLeavesPaymentUnresolved(string field, string? value)
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetResponse(Receipt(attempt.Transaction, field, value));
        var result = await PostAsync("ipn", Fields(attempt.Transaction));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, result.Status);
        Assert.Equal(1, fixture.Provider.Calls);
        await AssertUnresolvedAsync(attempt.Id);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("timeout"), InlineData("http"), InlineData("json"), InlineData("null")]
    public async Task ProviderTransportOrParseFailureLeavesPaymentUnresolved(string mode)
    {
        var attempt = await AttemptAsync();
        if (mode == "timeout") fixture.Provider.SetTimeout();
        else if (mode == "http") fixture.Provider.SetResponse(Receipt(attempt.Transaction), HttpStatusCode.ServiceUnavailable);
        else fixture.Provider.SetResponse(mode == "json" ? "{invalid" : "null");
        var result = await PostAsync("ipn", Fields(attempt.Transaction));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, result.Status);
        Assert.True(result.Retry);
        Assert.Contains("unresolved", result.Body);
        Assert.Equal(1, fixture.Provider.Calls);
        await AssertUnresolvedAsync(attempt.Id);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task VerifiedProviderFieldsOverrideCallbackHints()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetResponse(Receipt(attempt.Transaction));
        var fields = Fields(attempt.Transaction);
        fields["bank_tran_id"] = "forged-bank"; fields["card_type"] = "forged-card";
        fields["amount"] = "1.00"; fields["currency"] = "USD"; fields["value_a"] = "-1"; fields["status"] = "FAILED";
        var result = await PostAsync("ipn", fields);
        Assert.Equal(HttpStatusCode.OK, result.Status);
        var payment = await ReloadAsync(attempt.Id);
        Assert.Equal("Completed", payment.Status); Assert.Equal("Paid", payment.Booking.PaymentStatus);
        Assert.Equal("provider-bank", payment.BankTranId); Assert.Equal("provider-card", payment.CardType);
        Assert.Equal("fixture-validation", payment.ValId); Assert.NotNull(payment.PaidAt);
        using var stored = JsonDocument.Parse(payment.GatewayResponse!);
        Assert.Equal("1000.00", stored.RootElement.GetProperty("amount").GetString());
        Assert.Equal(attempt.Transaction, stored.RootElement.GetProperty("tran_id").GetString());
        Assert.DoesNotContain("forged", payment.GatewayResponse!);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("fail"), InlineData("cancel"), InlineData("ipn")]
    public async Task EveryRouteCanRecordOnlyProviderBoundSuccess(string route)
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetResponse(Receipt(attempt.Transaction, "status", "VALIDATED"));
        var fields = Fields(attempt.Transaction); fields["status"] = "CANCELLED";
        var result = await PostAsync(route, fields);
        Assert.Equal(HttpStatusCode.OK, result.Status);
        Assert.Equal(1, fixture.Provider.Calls);
        var payment = await ReloadAsync(attempt.Id);
        Assert.Equal("Completed", payment.Status); Assert.Equal("Paid", payment.Booking.PaymentStatus);
    }

    [Theory, Trait("Classification", "GreenBaseline")]
    [InlineData("fail"), InlineData("cancel"), InlineData("ipn")]
    public async Task LateCallbacksCannotDowngradeVerifiedSuccess(string route)
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        var completed = await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        fixture.Provider.Reset(); // A completed payment does not need a new receipt to preserve existing truth.
        var result = await PostAsync(route, new() { ["tran_id"] = attempt.Transaction, ["status"] = "FAILED" });
        Assert.Equal(HttpStatusCode.OK, result.Status);
        Assert.Equal(0, fixture.Provider.Calls);
        var payment = await ReloadAsync(attempt.Id);
        Assert.Equal("Completed", payment.Status); Assert.Equal("Paid", payment.Booking.PaymentStatus);
        Assert.Equal(completed.PaidAt, payment.PaidAt); Assert.Equal(completed.GatewayResponse, payment.GatewayResponse);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task ParticipantsCanReadAuthoritativeSummaryButStrangersCannot()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        await CallbackAsync(attempt.Id, attempt.Transaction, "fixture-validation");
        foreach (var token in new[] { attempt.Scenario.CustomerToken, attempt.Scenario.WorkerToken })
        {
            using var client = fixture.Client(token);
            using var response = await client.GetAsync($"/api/payments/booking/{attempt.Scenario.BookingId}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("Completed", body.RootElement.GetProperty("status").GetString());
        }
        using var stranger = fixture.Client(attempt.Scenario.StrangerToken);
        using var denied = await stranger.GetAsync($"/api/payments/booking/{attempt.Scenario.BookingId}");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.DoesNotContain(attempt.Transaction, await denied.Content.ReadAsStringAsync());
        using var guest = fixture.Client();
        using var anonymous = await guest.GetAsync($"/api/payments/booking/{attempt.Scenario.BookingId}");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public async Task DatabaseWriteFailureCannotPartiallyCompletePaymentAndBooking()
    {
        var attempt = await AttemptAsync();
        fixture.Provider.SetValidatedReceipt(attempt.Transaction);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        // A temporary constraint affects only this generated fixture booking. Production SQL is unchanged.
        // DDL cannot parameterize a CHECK literal. Format only a server-generated typed integer.
        var bookingIdLiteral = attempt.Scenario.BookingId!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        var constraintSql = "ALTER TABLE [dbo].[Bookings] ADD CONSTRAINT [CK_F1_FixturePaidFailure] CHECK ([Id] <> " +
                            bookingIdLiteral + " OR [PaymentStatus] <> 'Paid')";
        await db.Database.ExecuteSqlRawAsync(constraintSql);
        try
        {
            var result = await PostAsync("ipn", Fields(attempt.Transaction));
            Assert.Equal(HttpStatusCode.ServiceUnavailable, result.Status);
            Assert.Equal(1, fixture.Provider.Calls);
            await AssertUnresolvedAsync(attempt.Id);
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE [dbo].[Bookings] DROP CONSTRAINT [CK_F1_FixturePaidFailure]");
        }
    }
}
