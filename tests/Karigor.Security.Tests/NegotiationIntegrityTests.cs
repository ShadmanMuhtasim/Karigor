using System.Net;
using System.Net.Http.Json;
using Karigor.Application.Marketplace;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Finding", "F5"), Trait("Layer", "SQL")]
public sealed class NegotiationIntegrityTests(SecurityApplicationFixture fixture)
{
    private async Task<QuotationDto> Initial(Scenario s, int? requestId = null)
    {
        using var client = fixture.Client(s.WorkerToken);
        using var response = await client.PostAsJsonAsync("/api/quotations", new
        { serviceRequestId = requestId ?? s.RequestId, proposedPrice = 1000, message = "Original terms", proposedByUserId = "forged" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<QuotationDto>())!;
    }

    private async Task<QuotationDto> Counter(string token, QuotationDto offer, decimal price)
    {
        using var client = fixture.Client(token);
        using var response = await client.PostAsJsonAsync($"/api/quotations/{offer.Id}/counter", new
        { proposedPrice = price, expectedVersion = offer.Version, message = "Immutable child", proposedByUserId = "forged" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<QuotationDto>())!;
    }

    [Fact]
    public async Task ExplicitAuthorsIgnoreForgeryAndAcceptanceCapturesExactTerms()
    {
        var s = await fixture.SeedAsync();
        var first = await Initial(s);
        Assert.Equal(s.WorkerUserId, first.ProposedByUserId);
        Assert.NotNull(first.CreatedAt);
        Assert.Equal(8, Convert.FromBase64String(first.Version).Length);
        var second = await Counter(s.CustomerToken, first, 800);
        Assert.Equal(s.CustomerUserId, second.ProposedByUserId);
        var third = await Counter(s.WorkerToken, second, 900);
        Assert.Equal(s.WorkerUserId, third.ProposedByUserId);
        using var customer = fixture.Client(s.CustomerToken);
        using var response = await customer.PostAsJsonAsync($"/api/quotations/{third.Id}/accept", new { expectedVersion = third.Version });
        response.EnsureSuccessStatusCode();
        Assert.Equal(900, (await response.Content.ReadFromJsonAsync<BookingDto>())!.AgreedPrice);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var rows = await db.Quotations.AsNoTracking().Where(q => q.ServiceRequestId == s.RequestId).OrderBy(q => q.Id).ToListAsync();
        Assert.Equal(new[] { 1000m, 800m, 900m }, rows.Select(q => q.ProposedPrice));
        Assert.Equal(new[] { "Countered", "Countered", "Accepted" }, rows.Select(q => q.Status));
        Assert.Equal("InProgress", (await db.ServiceRequests.FindAsync(s.RequestId))!.Status);
    }

    [Theory]
    [InlineData("self", "accept")]
    [InlineData("self", "counter")]
    [InlineData("stranger", "accept")]
    [InlineData("stranger", "counter")]
    [InlineData("other-worker", "accept")]
    [InlineData("other-worker", "counter")]
    public async Task OnlyOppositeAuthorizedParticipantMayRespond(string actor, string action)
    {
        var s = await fixture.SeedAsync();
        var q = await Initial(s);
        var token = actor == "self" ? s.WorkerToken : actor == "stranger" ? s.StrangerToken : (await fixture.SeedAsync()).WorkerToken;
        using var client = fixture.Client(token);
        using var response = await client.PostAsJsonAsync($"/api/quotations/{q.Id}/{action}", new { expectedVersion = q.Version, proposedPrice = 800 });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("accept")]
    [InlineData("counter")]
    public async Task CustomerCannotRespondToOwnCounter(string action)
    {
        var s = await fixture.SeedAsync();
        var q = await Counter(s.CustomerToken, await Initial(s), 800);
        using var client = fixture.Client(s.CustomerToken);
        using var response = await client.PostAsJsonAsync($"/api/quotations/{q.Id}/{action}", new { expectedVersion = q.Version, proposedPrice = 700 });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("accept", "old-id")]
    [InlineData("counter", "old-id")]
    [InlineData("accept", "wrong-version")]
    [InlineData("counter", "wrong-version")]
    [InlineData("accept", "missing-version")]
    [InlineData("counter", "missing-version")]
    public async Task StaleOrMissingIntentReturnsStableConflict(string action, string stale)
    {
        var s = await fixture.SeedAsync();
        var first = await Initial(s);
        var next = await Counter(s.CustomerToken, first, 800);
        var q = stale == "old-id" ? first : next;
        using var client = fixture.Client(stale == "old-id" ? s.CustomerToken : s.WorkerToken);
        using var response = await client.PostAsJsonAsync($"/api/quotations/{q.Id}/{action}", new
        { expectedVersion = stale == "missing-version" ? null : stale == "wrong-version" ? first.Version : q.Version, proposedPrice = 700 });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("negotiation_conflict", await response.Content.ReadAsStringAsync());
    }

    // Both contexts finish reading the same authoritative state before either CAS write.
    private sealed class WriteBarrier : SaveChangesInterceptor
    {
        private int arrivals;
        private readonly HashSet<Guid> visited = [];
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (e.Context!.ChangeTracker.Entries<ServiceRequest>().Any(x => x.State == EntityState.Modified))
            {
                bool wait;
                lock (visited) wait = visited.Add(e.Context.ContextId.InstanceId);
                if (wait)
                {
                    if (Interlocked.Increment(ref arrivals) == 2) release.TrySetResult();
                    await release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
                }
            }
            return result;
        }
    }

    private async Task<bool> Compete(string actor, QuotationDto q, bool accept, WriteBarrier barrier)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        await using var db = new KarigorDbContext(new DbContextOptionsBuilder<KarigorDbContext>()
            .UseSqlServer(fixture.Database.ConnectionString).AddInterceptors(barrier).Options);
        var service = new MarketplaceService(db, scope.ServiceProvider.GetRequiredService<INotificationService>(),
            scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>());
        try
        {
            if (accept) await service.AcceptQuotationAsync(actor, q.Id, q.Version);
            else await service.CounterQuotationAsync(actor, q.Id, new CounterQuotationDto { ProposedPrice = 800, ExpectedVersion = q.Version });
            return true;
        }
        catch (NegotiationConflictException) { return false; }
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task CounterAndAcceptanceRacesHaveOneCoherentWinner(bool aAccept, bool bAccept)
    {
        var s = await fixture.SeedAsync();
        var q = await Initial(s);
        var barrier = new WriteBarrier();
        var results = await Task.WhenAll(Compete(s.CustomerUserId, q, aAccept, barrier), Compete(s.CustomerUserId, q, bAccept, barrier));
        Assert.Single(results, x => x);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var offers = await db.Quotations.Where(x => x.ServiceRequestId == s.RequestId).ToListAsync();
        Assert.InRange(offers.Count(x => x.Status == "Pending"), 0, 1);
        Assert.InRange(offers.Count(x => x.ParentQuotationId == q.Id), 0, 1);
        var bookings = await db.Bookings.Where(x => x.ServiceRequestId == s.RequestId).ToListAsync();
        Assert.Equal(bookings.Count, offers.Count(x => x.Status == "Accepted"));
        Assert.Equal(bookings.Count == 1 ? "InProgress" : "Open", (await db.ServiceRequests.FindAsync(s.RequestId))!.Status);
        if (bookings.Count == 1) Assert.Equal(1000, bookings[0].AgreedPrice);
        else { Assert.Equal("Countered", offers.Single(x => x.Id == q.Id).Status); Assert.Equal(800, offers.Single(x => x.Status == "Pending").ProposedPrice); }
    }

    [Fact]
    public async Task CompetingWorkersAcceptanceCreatesOneBookingAndRejectsLosingHead()
    {
        var s = await fixture.SeedAsync();
        var other = await fixture.SeedAsync();
        var a = await Initial(s);
        var b = await Initial(other, s.RequestId);
        var barrier = new WriteBarrier();
        Assert.Single(await Task.WhenAll(Compete(s.CustomerUserId, a, true, barrier), Compete(s.CustomerUserId, b, true, barrier)), x => x);
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Single(await db.Bookings.Where(x => x.ServiceRequestId == s.RequestId).ToListAsync());
        var statuses = await db.Quotations.Where(x => x.ServiceRequestId == s.RequestId).Select(x => x.Status).ToListAsync();
        Assert.Equal(new[] { "Accepted", "Rejected" }, statuses.Order());
    }

    [Fact]
    public async Task FailureAfterRequestAndOfferWritesRollsBackWholeAcceptance()
    {
        var s = await fixture.SeedAsync();
        var q = await Initial(s);
        var competitor = await Initial(await fixture.SeedAsync(), s.RequestId);
        using var scope = fixture.Factory.Services.CreateScope();
        await using var db = new KarigorDbContext(new DbContextOptionsBuilder<KarigorDbContext>()
            .UseSqlServer(fixture.Database.ConnectionString).Options);
        var service = new MarketplaceService(db, scope.ServiceProvider.GetRequiredService<INotificationService>(), scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>());
        // The only variable is a generated integer fixture ID, never caller input.
        var constraintSql = "ALTER TABLE dbo.Bookings ADD CONSTRAINT CK_F5_TestFailure CHECK(ServiceRequestId <> " + s.RequestId + ")";
        await db.Database.ExecuteSqlRawAsync(constraintSql);
        try
        {
            var failure = await Assert.ThrowsAsync<DbUpdateException>(() => service.AcceptQuotationAsync(s.CustomerUserId, q.Id, q.Version));
            Assert.Equal(547, ((SqlException)failure.InnerException!).Number);
        }
        finally { await db.Database.ExecuteSqlRawAsync("ALTER TABLE dbo.Bookings DROP CONSTRAINT CK_F5_TestFailure"); }
        db.ChangeTracker.Clear();
        Assert.Equal("Pending", (await db.Quotations.FindAsync(q.Id))!.Status);
        Assert.Equal("Open", (await db.ServiceRequests.FindAsync(s.RequestId))!.Status);
        Assert.False(await db.Bookings.AnyAsync(b => b.ServiceRequestId == s.RequestId));
        Assert.Equal("Pending", (await db.Quotations.FindAsync(competitor.Id))!.Status);
    }

    private sealed class RetryStrategy(ExecutionStrategyDependencies dependencies, Action beforeRetry)
        : ExecutionStrategy(dependencies, 1, TimeSpan.Zero)
    {
        protected override bool ShouldRetryOn(Exception exception)
        {
            if (exception is not TimeoutException) return false;
            beforeRetry(); return true;
        }
    }
    private sealed class TransientBookingFailure : SaveChangesInterceptor
    {
        private int failed;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData e, InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (e.Context!.ChangeTracker.Entries<Booking>().Any(x => x.State == EntityState.Added) && Interlocked.Exchange(ref failed, 1) == 0)
                throw new TimeoutException("F5 synthetic transient failure");
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task ExecutionStrategyRetryRereadsStateInsteadOfReusingTrackedAgreement()
    {
        var s = await fixture.SeedAsync(); var q = await Initial(s);
        int retries = 0;
        void BeforeRetry()
        {
            // This executes after the failed transaction has been disposed/rolled back.
            using var c = new SqlConnection(fixture.Database.ConnectionString); c.Open();
            using var command = c.CreateCommand(); command.CommandText = "UPDATE dbo.Quotations SET Status=N'Rejected' WHERE Id=@id";
            command.Parameters.AddWithValue("@id", q.Id); Assert.Equal(1, command.ExecuteNonQuery()); retries++;
        }
        using var scope = fixture.Factory.Services.CreateScope();
        await using var db = new KarigorDbContext(new DbContextOptionsBuilder<KarigorDbContext>()
            .UseSqlServer(fixture.Database.ConnectionString, o => o.ExecutionStrategy(d => new RetryStrategy(d, BeforeRetry)))
            .AddInterceptors(new TransientBookingFailure()).Options);
        var service = new MarketplaceService(db, scope.ServiceProvider.GetRequiredService<INotificationService>(), scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>());
        await Assert.ThrowsAsync<NegotiationConflictException>(() => service.AcceptQuotationAsync(s.CustomerUserId, q.Id, q.Version));
        Assert.Equal(1, retries);
        db.ChangeTracker.Clear();
        Assert.False(await db.Bookings.AnyAsync(b => b.ServiceRequestId == s.RequestId));
        Assert.Equal("Rejected", (await db.Quotations.FindAsync(q.Id))!.Status);
        Assert.Equal("Open", (await db.ServiceRequests.FindAsync(s.RequestId))!.Status);
    }

    [Fact]
    public async Task FractionalCentPriceIsRejectedRatherThanSilentlyChangingSubmittedTerms()
    {
        var s = await fixture.SeedAsync();
        using var worker = fixture.Client(s.WorkerToken);
        using var response = await worker.PostAsJsonAsync("/api/quotations", new { serviceRequestId = s.RequestId, proposedPrice = 1000.009m });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var q = await Initial(s);
        using var customer = fixture.Client(s.CustomerToken);
        using var counter = await customer.PostAsJsonAsync($"/api/quotations/{q.Id}/counter", new { expectedVersion = q.Version, proposedPrice = 800.009m });
        Assert.Equal(HttpStatusCode.BadRequest, counter.StatusCode);
    }

    [Fact]
    public async Task SqlRejectsTermMutationDuplicateHeadsForksAndDuplicateBookings()
    {
        var s = await fixture.SeedAsync();
        var q = await Initial(s);
        using var connection = new SqlConnection(fixture.Database.ConnectionString);
        await connection.OpenAsync();
        async Task Denied(string sql, params int[] numbers)
        {
            using var command = connection.CreateCommand(); command.CommandText = sql;
            var error = await Assert.ThrowsAsync<SqlException>(() => command.ExecuteNonQueryAsync());
            Assert.Contains(error.Number, numbers);
        }
        await Denied($"UPDATE dbo.Quotations SET ProposedPrice=5000 WHERE Id={q.Id}", 51007);
        await Denied($"UPDATE dbo.Quotations SET Message=N'Changed' WHERE Id={q.Id}", 51007);
        await Denied($"UPDATE dbo.Quotations SET Message=N'ORIGINAL TERMS' WHERE Id={q.Id}", 51007);
        await Denied($"UPDATE dbo.Quotations SET Message=Message+N' ' WHERE Id={q.Id}", 51007);
        await Denied($"INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ProposedByUserId,CreatedAt) VALUES({s.RequestId},{s.WorkerId},5000,N'Pending',N'{s.WorkerUserId}',SYSUTCDATETIME())", 2601, 2627);
        var child = await Counter(s.CustomerToken, q, 800);
        await Denied($"INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId,ProposedByUserId,CreatedAt) VALUES({s.RequestId},{s.WorkerId},700,N'Rejected',{q.Id},N'{s.CustomerUserId}',SYSUTCDATETIME())", 2601, 2627);
        using var worker = fixture.Client(s.WorkerToken);
        (await worker.PostAsJsonAsync($"/api/quotations/{child.Id}/accept", new { expectedVersion = child.Version })).EnsureSuccessStatusCode();
        await Denied($"INSERT dbo.Bookings(ServiceRequestId,WorkerId,CustomerId,AgreedPrice,ScheduledDate,Status) SELECT ServiceRequestId,WorkerId,CustomerId,5000,ScheduledDate,Status FROM dbo.Bookings WHERE ServiceRequestId={s.RequestId}", 2601, 2627);
    }
}
