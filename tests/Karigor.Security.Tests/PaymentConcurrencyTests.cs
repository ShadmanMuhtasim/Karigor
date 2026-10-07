using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Karigor.Application.Payments;
using Karigor.Application.Payments.DTOs;
using Karigor.Application.Payments.SslCommerz;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Finding", "F1"), Trait("Layer", "SQL")]
public sealed class PaymentConcurrencyTests(SecurityApplicationFixture fixture)
{
    private KarigorDbContext Context(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<KarigorDbContext>()
        .UseSqlServer(fixture.Database.ConnectionString).AddInterceptors(interceptors).Options);

    private PaymentService Service(KarigorDbContext db, Provider provider, ProbeNotifier? notifier = null)
    {
        provider.AssertOutsideTransaction = () => Assert.Null(db.Database.CurrentTransaction);
        return new(db, new SslCommerzClient(new HttpClient(provider, false), Options.Create(new SslCommerzOptions
            { StoreId = "fixture", StorePassword = "fixture", IsSandbox = false }), NullLogger<SslCommerzClient>.Instance),
            notifier ?? new ProbeNotifier(db), NullLogger<PaymentService>.Instance);
    }

    private sealed class ProbeNotifier(KarigorDbContext db) : IRealtimeNotifier
    {
        public int BookingPushes;
        public int UserPushes;
        public bool InsideTransaction;
        public Task NotifyUserAsync(string userId,string eventName,object data)
        { UserPushes++; InsideTransaction |= db.Database.CurrentTransaction != null; return Task.CompletedTask; }
        public Task NotifyBookingGroupAsync(int bookingId,string eventName,object data)
        { BookingPushes++; InsideTransaction |= db.Database.CurrentTransaction != null; return Task.CompletedTask; }
        public Task NotifyAdminsAsync(string eventName,object data) => throw new InvalidOperationException("Unexpected broad payment push");
        public Task BroadcastPublicRefreshAsync(string eventName) => throw new InvalidOperationException("Unexpected public payment push");
        public Task NotifyWorkersRefreshAsync(string eventName) => throw new InvalidOperationException("Unexpected broad payment push");
    }

    private sealed class Provider : HttpMessageHandler
    {
        public int Calls;
        public Action AssertOutsideTransaction = () => { };
        public Func<HttpRequestMessage, Task<HttpResponseMessage>> Respond = _ => throw new InvalidOperationException("Unconfigured fixture HTTP");
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref Calls);
            AssertOutsideTransaction();
            return Respond(request); // No underlying socket-backed handler.
        }
        public static HttpResponseMessage Json(object receipt) => new(HttpStatusCode.OK)
            { Content = new StringContent(JsonSerializer.Serialize(receipt), Encoding.UTF8, "application/json") };
        public static Provider Receipt(string transaction, string status = "VALID") => new()
        {
            Respond = r => { Assert.Equal(HttpMethod.Get, r.Method); return Task.FromResult(Json(new
                { status, tran_id = transaction, val_id = "receipt", amount = "1000.00", currency = "BDT", bank_tran_id = "bank-" + transaction })); }
        };
        public static Provider Init() => new()
        {
            Respond = r => { Assert.Equal(HttpMethod.Post, r.Method); return Task.FromResult(Json(new
                { status = "SUCCESS", sessionkey = "fixture-session", GatewayPageURL = "https://fixture.invalid/pay" })); }
        };
    }

    // Both SQL contexts read authoritative versions before either writes the Booking CAS.
    private sealed class WriteBarrier : SaveChangesInterceptor
    {
        private readonly ConcurrentDictionary<Guid, byte> visited = new();
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int arrivals;
        public int Conflicts;
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (e.Context!.ChangeTracker.Entries<Booking>().Any(x => x.State == EntityState.Modified) &&
                visited.TryAdd(e.Context.ContextId.InstanceId, 0))
            {
                if (Interlocked.Increment(ref arrivals) == 2) release.TrySetResult();
                await release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken);
            }
            return result;
        }
        public override ValueTask<InterceptionResult> ThrowingConcurrencyExceptionAsync(ConcurrencyExceptionEventData e,
            InterceptionResult result, CancellationToken cancellationToken = default)
        { Interlocked.Increment(ref Conflicts); return ValueTask.FromResult(result); }
    }

    private async Task<Payment> Attempt(Scenario scenario)
    {
        await using var db = Context();
        var payment = new Payment { BookingId = scenario.BookingId!.Value, TransactionId = "test-" + Guid.NewGuid().ToString("N")[..20],
            TotalAmount = 1000, PlatformFee = 20, ServiceCharge = 40, WorkerAmount = 940 };
        db.Payments.Add(payment); await db.SaveChangesAsync(); return payment;
    }

    private static Task<PaymentDetailsDto> Callback(PaymentService service, Payment p, string route = "success")
    {
        var callback = new SslCommerzCallbackDto { TranId = p.TransactionId, ValId = "receipt" };
        return route switch { "fail" => service.ProcessFailCallbackAsync(callback), "cancel" => service.ProcessCancelCallbackAsync(callback),
            "ipn" => service.ProcessIpnAsync(callback), _ => service.ProcessSuccessCallbackAsync(callback) };
    }

    private async Task AssertAllocated(Scenario scenario, int paymentId, int completed = 1, int review = 0)
    {
        await using var db = Context();
        var booking = await db.Bookings.AsNoTracking().SingleAsync(b => b.Id == scenario.BookingId);
        Assert.Equal("Paid", booking.PaymentStatus); Assert.Equal(paymentId, booking.SelectedPaymentId);
        var rows = await db.Payments.AsNoTracking().Where(p => p.BookingId == booking.Id).ToListAsync();
        Assert.Equal(completed, rows.Count(p => p.Status == "Completed")); Assert.Equal(review, rows.Count(p => p.RequiresReview));
        var selected = rows.Single(p => p.Id == paymentId);
        Assert.False(selected.RequiresReview); Assert.Equal("fixture", selected.VerifiedMerchantId);
        Assert.Equal("Live", selected.VerifiedEnvironment); Assert.Equal(selected.TransactionId, selected.VerifiedTransactionId);
        Assert.NotNull(selected.PaidAt); Assert.Equal("receipt", selected.ValId);
        Assert.Equal(1, await db.Notifications.CountAsync(n => n.RelatedEntityId == booking.Id && n.Type == "PaymentReceived"));
        Assert.Equal(review, await db.Notifications.CountAsync(n => n.RelatedEntityId == booking.Id && n.Type == "PaymentReview"));
    }

    [Fact]
    public async Task SequentialDuplicatesAndLateFailCancelHaveOneDurableEffect()
    {
        var s = await fixture.SeedAsync("Completed", true); var p = await Attempt(s);
        using var provider = Provider.Receipt(p.TransactionId); await using var db = Context(); var notifier = new ProbeNotifier(db); var service = Service(db, provider, notifier);
        var first = await Callback(service, p);
        foreach (var route in new[] { "success", "ipn", "fail", "cancel" })
        {
            var duplicate = await Callback(service, p, route);
            Assert.Equal(first.Version, duplicate.Version); Assert.True(duplicate.IsAllocated);
        }
        Assert.Equal(1, provider.Calls); Assert.Equal(1,notifier.UserPushes); Assert.Equal(1,notifier.BookingPushes);
        Assert.False(notifier.InsideTransaction); await AssertAllocated(s, p.Id);
    }

    [Theory]
    [InlineData("success")]
    [InlineData("fail")]
    [InlineData("cancel")]
    public async Task SimultaneousVerifiedRoutesConvergeAfterRealRowversionConflict(string otherRoute)
    {
        var s = await fixture.SeedAsync("Completed", true); var p = await Attempt(s); var barrier = new WriteBarrier();
        async Task<PaymentDetailsDto> Run(string route)
        {
            await using var db = Context(barrier); using var provider = Provider.Receipt(p.TransactionId);
            var result = await Callback(Service(db, provider), p, route); Assert.Equal(1, provider.Calls); return result;
        }
        var results = await Task.WhenAll(Run("success"), Run(otherRoute));
        Assert.All(results, r => Assert.True(r.IsAllocated)); Assert.True(barrier.Conflicts >= 1);
        await AssertAllocated(s, p.Id);
    }

    [Theory]
    [InlineData("fail")]
    [InlineData("cancel")]
    public async Task UnverifiedFailCancelRacingSuccessCannotChangeFinancialTruth(string route)
    {
        var s = await fixture.SeedAsync("Completed", true); var p = await Attempt(s);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); var arrivals = 0;
        async Task Run(bool success)
        {
            await using var db = Context(); using var provider = Provider.Receipt(p.TransactionId, success ? "VALID" : "INVALID");
            var respond = provider.Respond;
            provider.Respond = async r =>
            {
                if (Interlocked.Increment(ref arrivals) == 2) release.TrySetResult();
                await release.Task.WaitAsync(TimeSpan.FromSeconds(20)); return await respond(r);
            };
            var service = Service(db, provider);
            if (success) await Callback(service, p);
            else await Assert.ThrowsAsync<PaymentVerificationException>(() => Callback(service, p, route));
        }
        await Task.WhenAll(Run(true), Run(false)); await AssertAllocated(s, p.Id);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task TwoRealSettlementsRaceOneAllocationAndPreserveOtherReceiptForReview(bool concurrent)
    {
        var s = await fixture.SeedAsync("Completed", true); var first = await Attempt(s); var second = await Attempt(s);
        var barrier = new WriteBarrier();
        async Task Run(Payment p)
        { await using var db = concurrent ? Context(barrier) : Context(); using var provider = Provider.Receipt(p.TransactionId); await Callback(Service(db, provider), p); }
        if (concurrent) { await Task.WhenAll(Run(first), Run(second)); Assert.True(barrier.Conflicts >= 1); }
        else { await Run(first); await Run(second); }
        await using var read = Context(); var booking = await read.Bookings.SingleAsync(b => b.Id == s.BookingId);
        await AssertAllocated(s, booking.SelectedPaymentId!.Value, 2, 1);
        var unallocated = await read.Payments.SingleAsync(p => p.BookingId == booking.Id && p.Id != booking.SelectedPaymentId);
        Assert.Equal("Completed", unallocated.Status); Assert.True(unallocated.RequiresReview); Assert.NotNull(unallocated.GatewayResponse);
        using var lateProvider = Provider.Receipt(unallocated.TransactionId);
        var late = await Callback(Service(read, lateProvider), unallocated); Assert.True(late.RequiresReview); Assert.False(late.IsAllocated);
        Assert.Equal(0, lateProvider.Calls);
        var summary = await Service(read, lateProvider).GetBookingPaymentAsync(s.CustomerUserId, booking.Id);
        Assert.Equal(booking.SelectedPaymentId, summary!.Id); Assert.True(summary.IsAllocated);
        await AssertAllocated(s, booking.SelectedPaymentId.Value, 2, 1);
    }

    [Fact]
    public async Task NotificationDatabaseFailureRollsBackReceiptAllocationAndSummaryThenRetrySucceeds()
    {
        var s = await fixture.SeedAsync("Completed", true); var p = await Attempt(s);
        await using var db = Context();
        var faultSql = $"ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_fixture_payment_failure CHECK(RelatedEntityId<>{s.BookingId!.Value} OR Type<>N'PaymentReceived')";
        await db.Database.ExecuteSqlRawAsync(faultSql);
        try
        {
            using var provider = Provider.Receipt(p.TransactionId);
            await Assert.ThrowsAsync<DbUpdateException>(() => Callback(Service(db, provider), p));
            await using var read = Context(); var row = await read.Payments.SingleAsync(x => x.Id == p.Id);
            var booking = await read.Bookings.SingleAsync(b => b.Id == s.BookingId);
            Assert.Equal("Initiated", row.Status); Assert.Null(row.PaidAt); Assert.Null(row.VerifiedTransactionId);
            Assert.Equal("Unpaid", booking.PaymentStatus); Assert.Null(booking.SelectedPaymentId);
            Assert.Equal(0, await read.Notifications.CountAsync(n => n.RelatedEntityId == booking.Id));
        }
        finally { await db.Database.ExecuteSqlRawAsync("ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_fixture_payment_failure"); }
        using var retryProvider = Provider.Receipt(p.TransactionId); await Callback(Service(db, retryProvider), p); await AssertAllocated(s, p.Id);
    }

    [Fact]
    public async Task RepeatedInitiationAndLostApiResponseReusePersistedSession()
    {
        var s = await fixture.SeedAsync("Completed", true); using var provider = Provider.Init();
        await using var db = Context(); var result = await Service(db, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value);
        // Simulated caller never receives first result; a new application context retries.
        await using var retryDb = Context(); var retry = await Service(retryDb, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId.Value);
        Assert.Equal(result.TransactionId, retry.TransactionId); Assert.Equal(result.GatewayUrl, retry.GatewayUrl);
        Assert.Equal("Ready", retry.InitiationState); Assert.Equal(1, provider.Calls);
        Assert.Equal(1, await retryDb.Payments.CountAsync(p => p.BookingId == s.BookingId));
        var row = await retryDb.Payments.SingleAsync(p => p.BookingId == s.BookingId);
        Assert.Equal("fixture-session", row.ProviderSessionKey); Assert.Equal("fixture", row.InitiationMerchantId);
        Assert.Equal("Live", row.InitiationEnvironment); Assert.NotNull(row.InitiationDispatchedAt);
    }

    [Fact]
    public async Task DoubleClickCreatesOneIntentAndOneProviderDispatch()
    {
        var s = await fixture.SeedAsync("Completed", true); var barrier = new WriteBarrier();
        using var provider = Provider.Init();
        // Each handler asserts its own context, avoiding a shared mutable context assertion.
        using var provider2 = Provider.Init();
        async Task<InitiatePaymentResponseDto> Run(Provider handler)
        { await using var db = Context(barrier); return await Service(db, handler).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value); }
        var results = await Task.WhenAll(Run(provider), Run(provider2));
        Assert.Equal(results[0].TransactionId, results[1].TransactionId); Assert.Equal(1, provider.Calls + provider2.Calls);
        Assert.True(barrier.Conflicts >= 1);
        await using var read = Context(); Assert.Equal(1, await read.Payments.CountAsync(p => p.BookingId == s.BookingId));
        Assert.Equal("Ready", (await read.Payments.SingleAsync(p => p.BookingId == s.BookingId)).InitiationState);
    }

    [Theory]
    [InlineData("timeout")]
    [InlineData("malformed")]
    public async Task LostProviderResponseRemainsUnknownAndRetryNeverPostsAgain(string failure)
    {
        var s = await fixture.SeedAsync("Completed", true); using var provider = Provider.Init();
        provider.Respond = _ => failure == "timeout" ? throw new TaskCanceledException("provider may have created session")
            : Task.FromResult(Provider.Json(new { status = "SUCCESS", GatewayPageURL = "https://fixture.invalid/pay" }));
        await using var db = Context(); var result = await Service(db, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value);
        await using var retryDb = Context(); var retry = await Service(retryDb, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId.Value);
        Assert.Equal("Unknown", result.InitiationState); Assert.Equal("Unknown", retry.InitiationState);
        Assert.Empty(retry.GatewayUrl); Assert.Equal(result.TransactionId, retry.TransactionId); Assert.Equal(1, provider.Calls);
        Assert.Equal(1, await retryDb.Payments.CountAsync(p => p.BookingId == s.BookingId));
    }

    [Fact]
    public async Task DatabaseFailureSavingProviderResponseLeavesDispatchingAndRetryCannotCreateSession()
    {
        var s = await fixture.SeedAsync("Completed", true); using var provider = Provider.Init(); await using var db = Context();
        var faultSql = $"ALTER TABLE dbo.Payments ADD CONSTRAINT CK_fixture_ready_failure CHECK(BookingId<>{s.BookingId!.Value} OR InitiationState<>N'Ready')";
        await db.Database.ExecuteSqlRawAsync(faultSql);
        try { await Assert.ThrowsAsync<DbUpdateException>(() => Service(db, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value)); }
        finally { await db.Database.ExecuteSqlRawAsync("ALTER TABLE dbo.Payments DROP CONSTRAINT CK_fixture_ready_failure"); }
        await using var retryDb = Context(); var retry = await Service(retryDb, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value);
        Assert.Equal("Dispatching", retry.InitiationState); Assert.Empty(retry.GatewayUrl); Assert.Equal(1, provider.Calls);
        Assert.Equal(1, await retryDb.Payments.CountAsync(p => p.BookingId == s.BookingId));
    }

    [Fact]
    public async Task RetryDuringProviderDispatchReturnsPendingAndDoesNotHoldBookingLocks()
    {
        var s = await fixture.SeedAsync("Completed", true); using var provider = Provider.Init();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var respond = provider.Respond;
        provider.Respond = async r => { entered.TrySetResult(); await release.Task.WaitAsync(TimeSpan.FromSeconds(20)); return await respond(r); };
        await using var firstDb = Context(); var original = Service(firstDb, provider).InitiatePaymentAsync(s.CustomerUserId,s.BookingId!.Value);
        try
        {
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(20)); await using var retryDb = Context(); using var retryProvider = Provider.Init();
            var retry = await Service(retryDb,retryProvider).InitiatePaymentAsync(s.CustomerUserId,s.BookingId.Value);
            Assert.Equal("Dispatching",retry.InitiationState); Assert.Empty(retry.GatewayUrl); Assert.Equal(0,retryProvider.Calls);
            await retryDb.Database.ExecuteSqlRawAsync("UPDATE dbo.Bookings SET Status=Status WHERE Id={0}",s.BookingId.Value);
            release.TrySetResult(); var first = await original;
            Assert.Equal("Ready",first.InitiationState); Assert.Equal(first.TransactionId,retry.TransactionId); Assert.Equal(1,provider.Calls);
        }
        finally { release.TrySetResult(); await original; }
    }

    [Fact]
    public async Task ChangedTermsCannotReuseIntentOrOpenAnotherSession()
    {
        var s = await fixture.SeedAsync("Completed", true); using var provider = Provider.Init(); await using var db = Context();
        await Service(db, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId!.Value);
        await db.Database.ExecuteSqlRawAsync("UPDATE dbo.Bookings SET AgreedPrice=1100 WHERE Id={0}", s.BookingId.Value);
        await Assert.ThrowsAsync<PaymentConflictException>(() => Service(db, provider).InitiatePaymentAsync(s.CustomerUserId, s.BookingId.Value));
        Assert.Equal(1, provider.Calls); Assert.Equal(1, await db.Payments.CountAsync(p => p.BookingId == s.BookingId));
    }

    [Fact]
    public async Task StalePaymentAndBookingVersionsCannotOverwriteCommittedSettlement()
    {
        var s = await fixture.SeedAsync("Completed", true); var p = await Attempt(s);
        await using var staleDb = Context(); var stalePayment = await staleDb.Payments.SingleAsync(x => x.Id == p.Id);
        var staleBooking = await staleDb.Bookings.SingleAsync(b => b.Id == s.BookingId);
        await using var fresh = Context(); using var provider = Provider.Receipt(p.TransactionId); await Callback(Service(fresh, provider), p);
        stalePayment.Status = "Failed"; await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => staleDb.SaveChangesAsync());
        staleDb.ChangeTracker.Clear(); staleDb.Attach(staleBooking); staleBooking.PaymentStatus = "Failed";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => staleDb.SaveChangesAsync());
        await AssertAllocated(s, p.Id);
        Assert.Equal(547, (await Assert.ThrowsAsync<SqlException>(() => fresh.Database.ExecuteSqlRawAsync(
            "UPDATE dbo.Payments SET Status=N'Failed' WHERE Id={0}", p.Id))).Number);
        Assert.Equal(51073, (await Assert.ThrowsAsync<SqlException>(() => fresh.Database.ExecuteSqlRawAsync(
            "UPDATE dbo.Bookings SET PaymentStatus=N'Unpaid',SelectedPaymentId=NULL WHERE Id={0}", s.BookingId!.Value))).Number);
        await AssertAllocated(s, p.Id);
    }
}
