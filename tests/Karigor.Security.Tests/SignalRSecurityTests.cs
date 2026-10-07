using System.Collections.Concurrent;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Karigor.Api.Controllers;
using Karigor.Api.Hubs;
using Karigor.Application.Auth;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Finding", "F3"), Trait("Classification", "GreenBaseline")]
public sealed class SignalRSecurityTests(SecurityApplicationFixture fixture)
{
    private sealed class Peer : IAsyncDisposable
    {
        public HubConnection Connection { get; }
        public string? ConnectionToken { get; private set; }
        public ConcurrentQueue<(string Name, JsonElement Data)> Events { get; } = new();
        public ConcurrentDictionary<string, TaskCompletionSource> Fences { get; } = new();
        public Peer(WebApplicationFactory<PaymentsController> factory, string? token)
        {
            Connection = new HubConnectionBuilder().WithUrl("https://localhost/hubs/chat", options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => new CaptureConnectionToken(factory.Server.CreateHandler(), value => ConnectionToken = value);
                options.AccessTokenProvider = () => Task.FromResult(token);
            }).Build();
            foreach (var name in new[] { "ReceiveMessage", "UserTyping", "PaymentReceived", "QuotationUpdated",
                "WorkerVerificationUpdated", "ServiceRequestCreated", "ReviewCreated", "ReviewUpdated", "SosAlertTriggered" })
                Connection.On<JsonElement>(name, data => Events.Enqueue((name, data)));
            Connection.On<string>("SecurityFence", id => Fences[id].TrySetResult());
        }
        public async ValueTask DisposeAsync() => await Connection.DisposeAsync();
        public JsonElement Single(string name) => Assert.Single(Events, e => e.Name == name).Data;
    }

    private sealed class CaptureConnectionToken(HttpMessageHandler inner, Action<string> capture) : DelegatingHandler(inner)
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri!.AbsolutePath == "/hubs/chat" &&
                QueryHelpers.ParseQuery(request.RequestUri.Query).TryGetValue("id", out var id)) capture(id.ToString());
            return base.SendAsync(request, cancellationToken);
        }
    }

    // Observe the actual lifetime manager; all group operations still execute normally.
    private sealed class ObservedGroups(ILogger<DefaultHubLifetimeManager<KarigorHub>> logger) : DefaultHubLifetimeManager<KarigorHub>(logger)
    {
        public ConcurrentQueue<(string ConnectionId, string Group)> Adds { get; } = new();
        public override async Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            await base.AddToGroupAsync(connectionId, groupName, cancellationToken);
            Adds.Enqueue((connectionId, groupName));
        }
    }

    private WebApplicationFactory<PaymentsController> ObservedHost() => fixture.Factory.WithWebHostBuilder(builder =>
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<HubLifetimeManager<KarigorHub>>();
            services.AddSingleton<ObservedGroups>();
            services.AddSingleton<HubLifetimeManager<KarigorHub>>(sp => sp.GetRequiredService<ObservedGroups>());
        }));

    private Task FenceAsync(params Peer[] peers) => FenceAsync(fixture.Factory, peers);

    private async Task FenceAsync(WebApplicationFactory<PaymentsController> factory, params Peer[] peers)
    {
        var id = Guid.NewGuid().ToString("N");
        foreach (var peer in peers) peer.Fences[id] = new(TaskCreationOptions.RunContinuationsAsynchronously);
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IHubContext<KarigorHub>>().Clients.All.SendAsync("SecurityFence", id);
        await Task.WhenAll(peers.Select(p => p.Fences[id].Task)).WaitAsync(TimeSpan.FromSeconds(10));
    }

    private async Task<string> AdminTokenAsync()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var email = Guid.NewGuid() + "@security.invalid";
        var user = new ApplicationUser { UserName = email, Email = email };
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True((await manager.CreateAsync(user)).Succeeded);
        Assert.True((await manager.AddToRoleAsync(user, "Admin")).Succeeded);
        return (await scope.ServiceProvider.GetRequiredService<RefreshSessionService>().CreateAsync(user.Id)).result.AccessToken;
    }

    [Fact]
    public async Task AnonymousAndUnrelatedWorkerAndAdminCannotJoinOrType()
    {
        var s = await fixture.SeedAsync(booking: true);
        var other = await fixture.SeedAsync();
        await using var anonymous = new Peer(fixture.Factory, null);
        await Assert.ThrowsAsync<HttpRequestException>(() => anonymous.Connection.StartAsync());
        foreach (var token in new[] { other.WorkerToken, await AdminTokenAsync(), s.StrangerToken })
        {
            await using var peer = new Peer(fixture.Factory, token);
            await peer.Connection.StartAsync();
            await Assert.ThrowsAsync<HubException>(() => peer.Connection.InvokeAsync("JoinBooking", s.BookingId!.Value));
            await Assert.ThrowsAsync<HubException>(() => peer.Connection.InvokeAsync("SendTyping", s.BookingId!.Value, true));
            await Assert.ThrowsAsync<HubException>(() => peer.Connection.InvokeAsync("JoinBooking", -1));
        }
    }

    [Fact]
    public async Task ParticipantsReceiveTypingAndMessageWithoutTrustingCallerReceiver()
    {
        var s = await fixture.SeedAsync(booking: true);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var stranger = new Peer(fixture.Factory, s.StrangerToken);
        await Task.WhenAll(customer.Connection.StartAsync(), worker.Connection.StartAsync(), stranger.Connection.StartAsync());
        await customer.Connection.InvokeAsync("JoinBooking", s.BookingId!.Value);
        await worker.Connection.InvokeAsync("JoinBooking", s.BookingId.Value);
        await customer.Connection.InvokeAsync("SendTyping", s.BookingId.Value, true);
        using var http = fixture.Client(s.CustomerToken);
        using var response = await http.PostAsJsonAsync("/api/messages", new
        {
            bookingId = s.BookingId, receiverId = "attacker-supplied-recipient", content = "Private fixture chat"
        });
        response.EnsureSuccessStatusCode();
        await FenceAsync(customer, worker, stranger);
        Assert.Equal(s.CustomerUserId, worker.Single("UserTyping").GetProperty("userId").GetString());
        Assert.DoesNotContain(customer.Events, e => e.Name == "UserTyping");
        Assert.Equal(s.WorkerUserId, worker.Single("ReceiveMessage").GetProperty("receiverId").GetString());
        Assert.Equal("Private fixture chat", customer.Single("ReceiveMessage").GetProperty("content").GetString());
        Assert.Empty(stranger.Events);
    }

    [Fact]
    public async Task ReconnectAndExistingRoomCannotRetainChangedParticipation()
    {
        var s = await fixture.SeedAsync(booking: true);
        var replacement = await fixture.SeedAsync();
        await using var oldWorker = new Peer(fixture.Factory, s.WorkerToken);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await oldWorker.Connection.StartAsync();
        await customer.Connection.StartAsync();
        await oldWorker.Connection.InvokeAsync("JoinBooking", s.BookingId!.Value);
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
            var b = await db.Bookings.FindAsync(s.BookingId.Value);
            b!.WorkerId = replacement.WorkerId;
            await db.SaveChangesAsync();
            await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>()
                .NotifyBookingGroupAsync(b.Id, "ReceiveMessage", new { content = "Current participants only" });
        }
        await customer.Connection.InvokeAsync("SendTyping", s.BookingId.Value, true);
        await FenceAsync(oldWorker, customer);
        Assert.Empty(oldWorker.Events);
        Assert.Equal("Current participants only", customer.Single("ReceiveMessage").GetProperty("content").GetString());
        await Assert.ThrowsAsync<HubException>(() => oldWorker.Connection.InvokeAsync("SendTyping", s.BookingId.Value, true));
        await oldWorker.Connection.StopAsync();
        await oldWorker.Connection.StartAsync();
        await Assert.ThrowsAsync<HubException>(() => oldWorker.Connection.InvokeAsync("JoinBooking", s.BookingId.Value));
        await customer.Connection.StopAsync();
        await customer.Connection.StartAsync();
        await customer.Connection.InvokeAsync("JoinBooking", s.BookingId.Value);
    }

    [Fact]
    public async Task SuspensionDeniesMethodsAndPrivateDeliveryWithExistingJwt()
    {
        var s = await fixture.SeedAsync(booking: true);
        await using var factory = ObservedHost();
        await using var worker = new Peer(factory, s.WorkerToken);
        await using var customer = new Peer(factory, s.CustomerToken);
        await Task.WhenAll(worker.Connection.StartAsync(), customer.Connection.StartAsync());
        await worker.Connection.InvokeAsync("JoinBooking", s.BookingId!.Value);
        using var scope = factory.Services.CreateScope();
        var groups = scope.ServiceProvider.GetRequiredService<ObservedGroups>();
        var before = groups.Adds.Count;
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var user = await db.Users.FindAsync(s.WorkerUserId);
        user!.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1);
        await db.SaveChangesAsync();
        // Long Polling sends each invocation over HTTP. Assert the authentication boundary
        // directly, so background poll disconnection cannot change the client exception type.
        Assert.NotNull(worker.ConnectionToken);
        using var http = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        http.DefaultRequestHeaders.Authorization = new("Bearer", s.WorkerToken);
        foreach (var (method, arguments) in new[]
        {
            ("JoinBooking", new object[] { s.BookingId.Value }),
            ("SendTyping", new object[] { s.BookingId.Value, true })
        })
        {
            var invocation = JsonSerializer.Serialize(new { type = 1, invocationId = method, target = method, arguments }) + '\u001e';
            using var denied = await http.PostAsync("/hubs/chat?id=" + Uri.EscapeDataString(worker.ConnectionToken!),
                new StringContent(invocation, Encoding.UTF8, "text/plain"));
            Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        }
        Assert.Equal(before, groups.Adds.Count);
        var recipients = await scope.ServiceProvider.GetRequiredService<Karigor.Api.Realtime.SessionConnections>()
            .AuthorizedConnections(s.WorkerUserId, scope.ServiceProvider.GetRequiredService<RefreshSessionService>());
        Assert.Empty(recipients);
        await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>().NotifyBookingGroupAsync(s.BookingId.Value, "ReceiveMessage", new { content = "Denied" });
        await FenceAsync(factory, customer);
        Assert.Equal("Denied", customer.Single("ReceiveMessage").GetProperty("content").GetString());
        await worker.Connection.StopAsync();
        Assert.Empty(worker.Events);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task RevokedOrSuspendedHandshakeCannotObtainGroupsOrPrivateDelivery(bool suspend)
    {
        var s = await fixture.SeedAsync(booking: true);
        await using var factory = ObservedHost();
        using var scope = factory.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        var session = await sessions.CreateAsync(s.WorkerUserId);
        await using var healthy = new Peer(factory, s.CustomerToken);
        await healthy.Connection.StartAsync();
        await healthy.Connection.InvokeAsync("JoinBooking", s.BookingId!.Value);
        var groups = scope.ServiceProvider.GetRequiredService<ObservedGroups>();
        var before = groups.Adds.Count;
        if (suspend) await sessions.SetSuspensionAsync(s.WorkerUserId, true);
        else await sessions.LogoutAsync(session.rawRefreshToken);
        await using var denied = new Peer(factory, session.result.AccessToken);
        var failure = await Assert.ThrowsAsync<HttpRequestException>(() => denied.Connection.StartAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, failure.StatusCode);
        Assert.Equal(HubConnectionState.Disconnected, denied.Connection.State);
        Assert.Equal(before, groups.Adds.Count); // No user/role/booking membership from the denied handshake.
        Assert.All(groups.Adds, entry => Assert.Equal(healthy.Connection.ConnectionId, entry.ConnectionId));
        await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>().NotifyBookingGroupAsync(s.BookingId.Value,
            "ReceiveMessage", new { content = "Healthy participant only" });
        await FenceAsync(factory, healthy);
        Assert.Equal("Healthy participant only", healthy.Single("ReceiveMessage").GetProperty("content").GetString());
        Assert.Empty(denied.Events);
        Assert.False(await sessions.IsActiveAsync(s.WorkerUserId, session.result.SessionId));
    }

    [Fact]
    public async Task PaymentReceiptReachesOnlyBookingParticipants()
    {
        fixture.Provider.Reset();
        var s = await fixture.SeedAsync(booking: true);
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await using var stranger = new Peer(fixture.Factory, s.StrangerToken);
        await Task.WhenAll(worker.Connection.StartAsync(), customer.Connection.StartAsync(), stranger.Connection.StartAsync());
        var transaction = "fixture_" + Guid.NewGuid().ToString("N")[..20];
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
            db.Payments.Add(new Payment { BookingId = s.BookingId!.Value, TransactionId = transaction, TotalAmount = 1000,
                PlatformFee = 20, ServiceCharge = 40, WorkerAmount = 940, Status = "Initiated" });
            await db.SaveChangesAsync();
        }
        fixture.Provider.SetValidatedReceipt(transaction);
        using var http = fixture.Client();
        using var response = await http.PostAsync("/api/payments/sslcommerz/ipn", new FormUrlEncodedContent(new Dictionary<string, string>
        { ["tran_id"] = transaction, ["val_id"] = "fixture-validation" }));
        response.EnsureSuccessStatusCode();
        await FenceAsync(worker, customer, stranger);
        Assert.Equal("Completed", worker.Single("PaymentReceived").GetProperty("status").GetString());
        Assert.Equal(1000, customer.Single("PaymentReceived").GetProperty("totalAmount").GetDecimal());
        Assert.False(worker.Single("PaymentReceived").TryGetProperty("transactionId", out _));
        Assert.Empty(stranger.Events);
    }

    [Fact]
    public async Task QuotationCreateCounterAndAcceptReachOnlyTheirThread()
    {
        var s = await fixture.SeedAsync();
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await using var stranger = new Peer(fixture.Factory, s.StrangerToken);
        await Task.WhenAll(worker.Connection.StartAsync(), customer.Connection.StartAsync(), stranger.Connection.StartAsync());
        using var wh = fixture.Client(s.WorkerToken);
        using var ch = fixture.Client(s.CustomerToken);
        using var created = await wh.PostAsJsonAsync("/api/quotations", new { serviceRequestId = s.RequestId, proposedPrice = 1000 });
        created.EnsureSuccessStatusCode();
        var quote = (await created.Content.ReadFromJsonAsync<QuotationDto>())!;
        using var counterResponse = await ch.PostAsJsonAsync($"/api/quotations/{quote.Id}/counter", new { proposedPrice = 800, expectedVersion = quote.Version });
        counterResponse.EnsureSuccessStatusCode();
        var counter = (await counterResponse.Content.ReadFromJsonAsync<QuotationDto>())!;
        using var accepted = await wh.PostAsJsonAsync($"/api/quotations/{counter.Id}/accept", new { expectedVersion = counter.Version });
        accepted.EnsureSuccessStatusCode();
        await FenceAsync(worker, customer, stranger);
        Assert.Equal(3, worker.Events.Count(e => e.Name == "QuotationUpdated"));
        Assert.Equal(3, customer.Events.Count(e => e.Name == "QuotationUpdated"));
        Assert.Empty(stranger.Events);
    }

    [Fact]
    public async Task VerificationAdminDetailsAndWorkerResultAreSeparated()
    {
        var s = await fixture.SeedAsync();
        var adminToken = await AdminTokenAsync();
        await using var admin = new Peer(fixture.Factory, adminToken);
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var stranger = new Peer(fixture.Factory, s.StrangerToken);
        await Task.WhenAll(admin.Connection.StartAsync(), worker.Connection.StartAsync(), stranger.Connection.StartAsync());
        using var http = fixture.Client(adminToken);
        using var response = await http.PutAsJsonAsync($"/api/admin/workers/{s.WorkerId}/verify", new { status = "Rejected", note = "Please resubmit" });
        response.EnsureSuccessStatusCode();
        await FenceAsync(admin, worker, stranger);
        Assert.True(admin.Single("WorkerVerificationUpdated").TryGetProperty("documents", out _));
        var result = worker.Single("WorkerVerificationUpdated");
        Assert.Equal(new[] { "note", "verificationStatus" }, result.EnumerateObject().Select(p => p.Name).Order().ToArray());
        Assert.Equal("Rejected", result.GetProperty("verificationStatus").GetString());
        Assert.Empty(stranger.Events);
    }

    [Fact]
    public async Task DiscoveryAndReviewEventsContainOnlyRefreshHint()
    {
        var s = await fixture.SeedAsync(booking: true);
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await Task.WhenAll(worker.Connection.StartAsync(), customer.Connection.StartAsync());
        using var http = fixture.Client(s.CustomerToken);
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var category = await scope.ServiceProvider.GetRequiredService<KarigorDbContext>().ServiceCategories.FirstAsync();
            using var response = await http.PostAsJsonAsync("/api/customer/requests", new { categoryId = category.Id,
                description = "Private description", address = "Exact private address", latitude = 23.81, longitude = 90.41, preferredDate = DateTime.UtcNow.AddDays(1) });
            response.EnsureSuccessStatusCode();
        }
        using var review = await http.PostAsJsonAsync("/api/reviews", new { bookingId = s.BookingId, rating = 5, comment = "Review fixture" });
        review.EnsureSuccessStatusCode();
        await FenceAsync(worker, customer);
        Assert.Equal("{\"refresh\":true}", worker.Single("ServiceRequestCreated").GetRawText());
        Assert.DoesNotContain(customer.Events, e => e.Name == "ServiceRequestCreated");
        Assert.Equal("{\"refresh\":true}", worker.Single("ReviewCreated").GetRawText());
        Assert.Equal("{\"refresh\":true}", customer.Single("ReviewCreated").GetRawText());
        var reviewId = (await review.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        using var workerHttp = fixture.Client(s.WorkerToken);
        using var updated = await workerHttp.PutAsJsonAsync($"/api/reviews/{reviewId}/response", new { response = "Thank you" });
        updated.EnsureSuccessStatusCode();
        await FenceAsync(worker, customer);
        Assert.Equal("{\"refresh\":true}", worker.Single("ReviewUpdated").GetRawText());
        Assert.Equal("{\"refresh\":true}", customer.Single("ReviewUpdated").GetRawText());
    }

    [Fact]
    public async Task CompetingWorkerReceivesClosedHintWithoutWinningPrice()
    {
        var s = await fixture.SeedAsync();
        var other = await fixture.SeedAsync();
        await using var competitor = new Peer(fixture.Factory, other.WorkerToken);
        await competitor.Connection.StartAsync();
        using var otherHttp = fixture.Client(other.WorkerToken);
        using var wh = fixture.Client(s.WorkerToken);
        using var ch = fixture.Client(s.CustomerToken);
        using var rivalQuote = await otherHttp.PostAsJsonAsync("/api/quotations", new { serviceRequestId = s.RequestId, proposedPrice = 700 });
        rivalQuote.EnsureSuccessStatusCode();
        using var created = await wh.PostAsJsonAsync("/api/quotations", new { serviceRequestId = s.RequestId, proposedPrice = 1000 });
        created.EnsureSuccessStatusCode();
        var quote = (await created.Content.ReadFromJsonAsync<QuotationDto>())!;
        using var accepted = await ch.PostAsJsonAsync($"/api/quotations/{quote.Id}/accept", new { expectedVersion = quote.Version });
        accepted.EnsureSuccessStatusCode();
        await FenceAsync(competitor);
        var events = competitor.Events.Where(e => e.Name == "QuotationUpdated").Select(e => e.Data).ToArray();
        Assert.Equal(2, events.Length);
        Assert.Equal(700, events[0].GetProperty("price").GetDecimal());
        Assert.Equal("Closed", events[1].GetProperty("status").GetString());
        Assert.False(events[1].TryGetProperty("price", out _));
        Assert.False(events[1].TryGetProperty("bookingId", out _));
    }

    [Fact]
    public async Task SosDetailsReachOnlyCurrentAdmins()
    {
        var s = await fixture.SeedAsync(booking: true);
        var adminToken = await AdminTokenAsync();
        await using var admin = new Peer(fixture.Factory, adminToken);
        await using var worker = new Peer(fixture.Factory, s.WorkerToken);
        await using var customer = new Peer(fixture.Factory, s.CustomerToken);
        await Task.WhenAll(admin.Connection.StartAsync(), worker.Connection.StartAsync(), customer.Connection.StartAsync());
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
            var b = await db.Bookings.FindAsync(s.BookingId);
            b!.Status = "Scheduled";
            await db.SaveChangesAsync();
        }
        using var http = fixture.Client(s.CustomerToken);
        using var response = await http.PostAsync($"/api/bookings/{s.BookingId}/sos", null);
        response.EnsureSuccessStatusCode();
        await FenceAsync(admin, worker, customer);
        Assert.Equal(s.BookingId, admin.Single("SosAlertTriggered").GetProperty("bookingId").GetInt32());
        Assert.Empty(worker.Events);
        Assert.Empty(customer.Events);
    }

    private sealed class MembershipFailure : DbCommandInterceptor
    {
        public bool Enabled { get; set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && command.CommandText.Contains("[Bookings]"))
                throw new InvalidOperationException("Fixture membership lookup unavailable");
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task DatabaseLookupFailureDeniesJoinAndTyping()
    {
        var s = await fixture.SeedAsync(booking: true);
        var failure = new MembershipFailure();
        await using var factory = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddDbContext<KarigorDbContext>(options => options.AddInterceptors(failure))));
        // The derived factory also uses the same isolated fixture database, never application SQL.
        await using var peer = new HubConnectionBuilder().WithUrl("https://localhost/hubs/chat", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(s.WorkerToken);
        }).Build();
        await peer.StartAsync();
        failure.Enabled = true;
        await Assert.ThrowsAsync<HubException>(() => peer.InvokeAsync("JoinBooking", s.BookingId!.Value));
        await Assert.ThrowsAsync<HubException>(() => peer.InvokeAsync("SendTyping", s.BookingId!.Value, true));
        failure.Enabled = false;
        await peer.InvokeAsync("JoinBooking", s.BookingId!.Value);
    }
}
