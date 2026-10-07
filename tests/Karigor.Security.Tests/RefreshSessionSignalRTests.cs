using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Net.WebSockets;
using Karigor.Api.Hubs;
using Karigor.Application.Auth;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Finding", "F6"), Trait("Layer", "Integration")]
public sealed class RefreshSessionSignalRTests(SecurityApplicationFixture fixture)
{
    [Fact]
    public async Task TransportClosesWebSocketAtRealJwtExpiryWhileSessionRemainsActive()
    {
        var scenario = await fixture.SeedAsync();
        using var scope = fixture.Factory.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        var session = await sessions.CreateAsync(scenario.CustomerUserId);
        var jwt = new JwtSecurityToken("karigor-security-tests", "karigor-security-tests",
            [new Claim("sub", scenario.CustomerUserId), new Claim("sid", session.result.SessionId.ToString())],
            expires: DateTime.UtcNow.AddSeconds(4), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes("fixture-only-signing-key-64-characters-never-use-in-production-123456")), SecurityAlgorithms.HmacSha256));
        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        await using var peer = new HubConnectionBuilder().WithUrl("https://localhost/hubs/chat", options =>
        {
            options.Transports = HttpTransportType.WebSockets;
            options.HttpMessageHandlerFactory = _ => fixture.Factory.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(token);
            options.WebSocketFactory = async (context, cancellation) =>
            {
                var socket = fixture.Factory.Server.CreateWebSocketClient();
                socket.ConfigureRequest = request => request.Headers.Authorization = "Bearer " + token;
                return await socket.ConnectAsync(context.Uri, cancellation);
            };
        }).Build();
        var closed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        peer.Closed += _ => { closed.TrySetResult(); return Task.CompletedTask; };
        await peer.StartAsync();
        await closed.Task.WaitAsync(TimeSpan.FromSeconds(15));
        Assert.Equal(HubConnectionState.Disconnected, peer.State);
        Assert.True(await sessions.IsActiveAsync(scenario.CustomerUserId, session.result.SessionId));
        await Assert.ThrowsAsync<InvalidOperationException>(() => peer.InvokeAsync("SendTyping", 1, true));
    }

    [Theory]
    [InlineData("Logout")] [InlineData("Replay")] [InlineData("Suspension")] [InlineData("Expiry")]
    public async Task ExistingWebSocketCannotInvokeOrReceivePrivateDataAfterSessionDenial(string reason)
    {
        var scenario = await fixture.SeedAsync(booking: true);
        var clock = new RefreshSessionSecurityTests.Clock();
        await using var host = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>(); services.AddSingleton<TimeProvider>(clock);
        }));
        using var scope = host.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        var first = await sessions.CreateAsync(scenario.CustomerUserId);
        var other = await sessions.CreateAsync(scenario.CustomerUserId);
        HubConnection Connect(string token) => new HubConnectionBuilder().WithUrl("https://localhost/hubs/chat", options =>
        {
            options.Transports = HttpTransportType.WebSockets;
            options.HttpMessageHandlerFactory = _ => host.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(token);
            options.WebSocketFactory = async (context, cancellation) =>
            {
                var socketClient = host.Server.CreateWebSocketClient();
                socketClient.ConfigureRequest = request => request.Headers.Authorization = "Bearer " + token;
                return await socketClient.ConnectAsync(context.Uri, cancellation);
            };
        }).Build();
        await using var peer = Connect(first.result.AccessToken);
        await using var device = Connect(other.result.AccessToken);
        var events = new ConcurrentQueue<string>(); var deviceEvents = new ConcurrentQueue<string>();
        var fence = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var deviceFence = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        peer.On<string>("PrivateProbe", events.Enqueue);
        device.On<string>("PrivateProbe", deviceEvents.Enqueue);
        peer.On("F6Fence", () => fence.TrySetResult());
        device.On("F6Fence", () => deviceFence.TrySetResult());
        await Task.WhenAll(peer.StartAsync(), device.StartAsync());
        await peer.InvokeAsync("JoinBooking", scenario.BookingId!.Value);
        await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>().NotifyUserAsync(scenario.CustomerUserId, "PrivateProbe", "before");
        await scope.ServiceProvider.GetRequiredService<IHubContext<KarigorHub>>().Clients.All.SendAsync("F6Fence");
        await Task.WhenAll(fence.Task, deviceFence.Task).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Contains("before", events);
        while (events.TryDequeue(out _)) { }
        while (deviceEvents.TryDequeue(out _)) { }
        fence = new(TaskCreationOptions.RunContinuationsAsynchronously);
        deviceFence = new(TaskCreationOptions.RunContinuationsAsynchronously);
        switch (reason)
        {
            case "Logout": await sessions.LogoutAsync(first.rawRefreshToken); break;
            case "Replay":
                await sessions.RefreshAsync(first.rawRefreshToken);
                await Assert.ThrowsAsync<UnauthorizedAccessException>(() => sessions.RefreshAsync(first.rawRefreshToken));
                break;
            case "Suspension": await sessions.SetSuspensionAsync(scenario.CustomerUserId, true); break;
            case "Expiry": clock.Advance(TimeSpan.FromMinutes(16)); break; // Current JWT expiry, while family itself is still valid.
        }
        await Assert.ThrowsAsync<HubException>(() => peer.InvokeAsync("JoinBooking", scenario.BookingId.Value));
        await Assert.ThrowsAsync<HubException>(() => peer.InvokeAsync("SendTyping", scenario.BookingId.Value, true));
        await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>().NotifyUserAsync(scenario.CustomerUserId, "PrivateProbe", "after");
        await scope.ServiceProvider.GetRequiredService<IHubContext<KarigorHub>>().Clients.All.SendAsync("F6Fence");
        await Task.WhenAll(fence.Task, deviceFence.Task).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Empty(events);
        if (reason is "Logout" or "Replay") Assert.Contains("after", deviceEvents);
        else Assert.DoesNotContain("after", deviceEvents);
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var stored = await db.RefreshSessions.AsNoTracking().SingleAsync(s => s.Id == first.result.SessionId);
        if (reason != "Expiry") Assert.NotNull(stored.RevokedAt);
        else Assert.Null(stored.RevokedAt); // Distinguishes expiration from revocation.
    }
}
