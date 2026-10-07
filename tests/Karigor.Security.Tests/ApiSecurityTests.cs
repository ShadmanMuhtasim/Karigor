using System.Net;
using System.Net.Http.Json;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration")]
public sealed class ApiSecurityTests(SecurityApplicationFixture fixture)
{
    [Fact, Trait("Finding", "F2"), Trait("Classification", "GreenBaseline")]
    public async Task OrdinaryProductionStartupDoesNotProvisionDefaultAdministrator()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        Assert.Equal("Production", scope.ServiceProvider.GetRequiredService<IHostEnvironment>().EnvironmentName);
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByEmailAsync("admin@karigor.com");
        Assert.True(user is null,
            "F2_DEFAULT_ADMIN: ordinary Production startup must not provision the hardcoded administrator.");
    }

    private HubConnection Connection(string token) => new HubConnectionBuilder()
        .WithUrl("https://localhost/hubs/chat", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => fixture.Factory.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(token);
        }).Build();

    [Fact, Trait("Finding", "F3"), Trait("Classification", "GreenBaseline")]
    public async Task UnrelatedAuthenticatedUserCannotJoinBooking()
    {
        var scenario = await fixture.SeedAsync(booking: true);
        await using var connection = Connection(scenario.StrangerToken);
        await connection.StartAsync();
        var denied = false;
        try { await connection.InvokeAsync("JoinBooking", scenario.BookingId!.Value); }
        catch (HubException) { denied = true; }
        Assert.True(denied,
            "F3_BOOKING_MEMBERSHIP: an unrelated authenticated user must be denied booking membership.");
    }

    [Fact, Trait("Finding", "F3"), Trait("Classification", "GreenBaseline")]
    public async Task BookingParticipantCanJoinAndReceiveGroupEvent()
    {
        var scenario = await fixture.SeedAsync(booking: true);
        await using var connection = Connection(scenario.WorkerToken);
        var received = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string>("SecurityFixtureProbe", value => received.TrySetResult(value));
        await connection.StartAsync();
        await connection.InvokeAsync("JoinBooking", scenario.BookingId!.Value);
        using var scope = fixture.Factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IRealtimeNotifier>()
            .NotifyBookingGroupAsync(scenario.BookingId.Value, "SecurityFixtureProbe", "fixture-only");
        Assert.Equal("fixture-only", await received.Task.WaitAsync(TimeSpan.FromSeconds(10)));
    }

    [Fact, Trait("Finding", "F5"), Trait("Classification", "ExpectedFailRegression")]
    public async Task WorkerCannotOverwriteAndAcceptCustomerCounterOffer()
    {
        var scenario = await fixture.SeedAsync();
        using var worker = fixture.Client(scenario.WorkerToken);
        using var customer = fixture.Client(scenario.CustomerToken);
        using var first = await worker.PostAsJsonAsync("/api/quotations",
            new { serviceRequestId = scenario.RequestId, proposedPrice = 1000 });
        first.EnsureSuccessStatusCode();
        var quote = (await first.Content.ReadFromJsonAsync<QuotationDto>())!;
        using var counterResponse = await customer.PostAsJsonAsync($"/api/quotations/{quote.Id}/counter",
            new { proposedPrice = 800 });
        counterResponse.EnsureSuccessStatusCode();
        var counter = (await counterResponse.Content.ReadFromJsonAsync<QuotationDto>())!;
        Assert.Equal("Customer", counter.ProposedBy);
        using var overwrite = await worker.PostAsJsonAsync("/api/quotations",
            new { serviceRequestId = scenario.RequestId, proposedPrice = 5000 });
        Assert.Contains(overwrite.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Created,
            HttpStatusCode.BadRequest, HttpStatusCode.Forbidden, HttpStatusCode.Conflict });
        // A later fix may reject this request. Either way, the stored customer terms must survive.
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var stored = await db.Quotations.AsNoTracking().SingleAsync(q => q.Id == counter.Id);
        var originalTermsSurvived = stored.ProposedPrice == 800;
        using var accepted = await worker.PostAsync($"/api/quotations/{counter.Id}/accept", content: null);
        if (accepted.IsSuccessStatusCode)
        {
            var booking = (await accepted.Content.ReadFromJsonAsync<BookingDto>())!;
            originalTermsSurvived &= booking.AgreedPrice == 800;
        }
        else
        {
            // Documented denied/conflict response, not a hidden infrastructure failure.
            Assert.Contains(accepted.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.Forbidden, HttpStatusCode.Conflict });
        }
        Assert.True(originalTermsSurvived,
            "F5_CUSTOMER_OFFER: the worker's new 5000 initial offer must not overwrite or accept altered customer 800 terms.");
    }

    private async Task<(Scenario Scenario, string Url, byte[] Bytes)> DocumentAsync()
    {
        var scenario = await fixture.SeedAsync();
        var file = Guid.NewGuid().ToString("N") + ".png";
        var directory = Path.Combine(fixture.UploadRoot, scenario.WorkerId.ToString());
        Directory.CreateDirectory(directory);
        var bytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        await File.WriteAllBytesAsync(Path.Combine(directory, file), bytes);
        var url = $"/uploads/worker-documents/{scenario.WorkerId}/{file}";
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        db.WorkerDocuments.Add(new WorkerDocument { WorkerId = scenario.WorkerId, DocumentType = "Fixture", FileUrl = url, Status = "Pending" });
        await db.SaveChangesAsync();
        return (scenario, url, bytes);
    }

    [Fact, Trait("Finding", "F7"), Trait("Classification", "GreenBaseline")]
    public async Task DocumentOwnerReceivesCompleteFileThroughMvc()
    {
        var document = await DocumentAsync();
        using var client = fixture.Client(document.Scenario.WorkerToken);
        using var response = await client.GetAsync(document.Url);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK && bytes.SequenceEqual(document.Bytes),
            "F7_STREAM_LIFETIME: an authorized document owner must receive complete bytes through MVC result execution.");
    }

    [Fact, Trait("Finding", "F7"), Trait("Classification", "GreenBaseline")]
    public async Task NonOwnerCannotDownloadPrivateDocument()
    {
        var document = await DocumentAsync();
        using var client = fixture.Client(document.Scenario.StrangerToken);
        using var response = await client.GetAsync(document.Url);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
