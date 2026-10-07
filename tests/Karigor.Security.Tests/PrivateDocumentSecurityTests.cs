using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Data.Common;
using Karigor.Abstractions.Worker;
using Karigor.Api.Controllers;
using Karigor.Application.Auth;
using Karigor.Application.Worker;
using Karigor.Application.Worker.DTOs;
using Karigor.Infrastructure.Models;
using Karigor.Infrastructure.Upload;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Karigor.Security.Tests;

[Trait("Layer", "Unit"), Trait("Finding", "F7"), Trait("Classification", "GreenBaseline")]
public sealed class DocumentFormatAndRootTests
{
    [Theory]
    [InlineData("pdf", "%PDF-", true)]
    [InlineData("pdf", "%FDP-", false)]
    [InlineData("pdf", "%PDF", false)]
    [InlineData("pdf", "%PD", false)]
    [InlineData("png", "%PDF-1.7", false)]
    [InlineData("exe", "%PDF-1.7", false)]
    [InlineData("svg", "<svg/>", false)]
    public void SignatureMustMatchSupportedFormat(string extension, string prefix, bool expected)
    {
        using var stream = new MemoryStream(System.Text.Encoding.ASCII.GetBytes(prefix));
        Assert.Equal(expected, FileValidationService.ValidateStream(stream, extension, out _));
        Assert.Equal(0, stream.Position);
    }

    [Theory]
    [InlineData("jpg")]
    [InlineData("jpeg")]
    public void JpegSignatureAndCallerPositionArePreserved(string extension)
    {
        using var stream = new MemoryStream([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
        stream.Position = 2;
        Assert.True(FileValidationService.ValidateStream(stream, extension, out _));
        Assert.Equal(2, stream.Position);
        using var truncated = new MemoryStream([0xff, 0xd8]);
        Assert.False(FileValidationService.ValidateStream(truncated, extension, out _));
    }

    [Theory]
    [InlineData("wwwroot")]
    [InlineData("wwwroot/uploads/private")]
    [InlineData("outside/../wwwroot/private")]
    public void ConfiguredRootCannotBePublic(string relative)
    {
        var content = Path.Combine(Path.GetTempPath(), "Karigor_SecurityTests_" + Guid.NewGuid().ToString("N"));
        Assert.Throws<InvalidOperationException>(() => new PrivateUploadPathProvider(content, relative));
        Assert.Throws<InvalidOperationException>(() => new PrivateUploadPathProvider(content,
            Path.Combine(content, "custom-public", "private"), Path.Combine(content, "custom-public")));
    }

    [Fact]
    public void RequestLimitAllowsBoundedMultipartOverhead()
    {
        var method = typeof(WorkerController).GetMethod(nameof(WorkerController.UploadDocument))!;
        Assert.Equal(5 * 1024 * 1024 + 64 * 1024,
            ((Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata)method.GetCustomAttribute<RequestSizeLimitAttribute>()!).MaxRequestBodySize);
        Assert.Equal(5 * 1024 * 1024, method.GetCustomAttribute<RequestFormLimitsAttribute>()!.MultipartBodyLengthLimit);
    }
}

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Finding", "F7"), Trait("Classification", "GreenBaseline")]
public sealed class PrivateDocumentSecurityTests(SecurityApplicationFixture fixture)
{
    private static byte[] Png => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private async Task<HttpResponseMessage> UploadAsync(Scenario s, byte[] bytes, string filename = "fixture.png", string type = "Fixture")
    {
        using var http = fixture.Client(s.WorkerToken);
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(type), "documentType");
        form.Add(new ByteArrayContent(bytes), "file", filename);
        return await http.PostAsync("/api/worker/documents", form);
    }

    private async Task<WorkerDocumentDto> UploadValidAsync(Scenario s)
    {
        using var response = await UploadAsync(s, Png);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<WorkerDocumentDto>())!;
    }

    private async Task<string> AdminTokenAsync()
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = Guid.NewGuid() + "@security.invalid";
        var user = new ApplicationUser { UserName = email, Email = email };
        Assert.True((await manager.CreateAsync(user)).Succeeded);
        Assert.True((await manager.AddToRoleAsync(user, "Admin")).Succeeded);
        return (await scope.ServiceProvider.GetRequiredService<RefreshSessionService>().CreateAsync(user.Id)).result.AccessToken;
    }

    [Fact]
    public async Task OwnerAndAdminReceiveExactValidatedBytesAndSecurityHeaders()
    {
        var s = await fixture.SeedAsync();
        var doc = await UploadValidAsync(s);
        using var scope = fixture.Factory.Services.CreateScope();
        Assert.Equal(Path.GetFullPath(fixture.UploadRoot), scope.ServiceProvider.GetRequiredService<IUploadPathProvider>().GetUploadRoot());
        Assert.IsType<PrivateUploadPathProvider>(scope.ServiceProvider.GetRequiredService<IUploadPathProvider>());
        var physical = Path.Combine(fixture.UploadRoot, s.WorkerId.ToString(), Path.GetFileName(doc.FileUrl));
        Assert.Equal(Png, await File.ReadAllBytesAsync(physical));
        foreach (var token in new[] { s.WorkerToken, await AdminTokenAsync() })
        {
            using var http = fixture.Client(token);
            using var response = await http.GetAsync(doc.FileUrl);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(Png, await response.Content.ReadAsByteArrayAsync());
            Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
            Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
            Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        }
        File.Delete(physical); // On Windows this also checks that MVC released the response handle.
        using var owner = fixture.Client(s.WorkerToken);
        using var missing = await owner.GetAsync(doc.FileUrl);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task AnonymousAndUnrelatedWorkerAndCustomerReceiveNoDocument()
    {
        var s = await fixture.SeedAsync();
        var other = await fixture.SeedAsync();
        var doc = await UploadValidAsync(s);
        foreach (var token in new[] { s.StrangerToken, other.WorkerToken, (string?)null })
        {
            using var http = fixture.Client(token);
            using var response = await http.GetAsync(doc.FileUrl);
            Assert.Equal(token is null ? HttpStatusCode.Unauthorized : HttpStatusCode.NotFound, response.StatusCode);
            Assert.NotEqual(Png, await response.Content.ReadAsByteArrayAsync());
        }
        using var stranger = fixture.Client(s.StrangerToken);
        using var upload = new MultipartFormDataContent();
        upload.Add(new StringContent("Fixture"), "documentType");
        upload.Add(new ByteArrayContent(Png), "file", "fixture.png");
        using var forbidden = await stranger.PostAsync("/api/worker/documents", upload);
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Theory]
    [InlineData("not-a-guid.png")]
    [InlineData("00000000000000000000000000000000.exe")]
    [InlineData("..%2f..%2fappsettings.json")]
    [InlineData("..%5c..%5cappsettings.json")]
    [InlineData("%252e%252e%252fappsettings.json")]
    [InlineData("00000000000000000000000000000000.png%0a")]
    public async Task InvalidFileNamesAndTraversalNeverRevealPrivateBytes(string segment)
    {
        var s = await fixture.SeedAsync();
        using var http = fixture.Client(s.WorkerToken);
        using var response = await http.GetAsync($"/uploads/worker-documents/{s.WorkerId}/{segment}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain(fixture.UploadRoot, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task WrongWorkerFilePairAndUnvalidatedStoredBytesAreDenied()
    {
        var s = await fixture.SeedAsync();
        var other = await fixture.SeedAsync();
        var doc = await UploadValidAsync(s);
        using var admin = fixture.Client(await AdminTokenAsync());
        using var wrong = await admin.GetAsync($"/uploads/worker-documents/{other.WorkerId}/{Path.GetFileName(doc.FileUrl)}");
        Assert.Equal(HttpStatusCode.NotFound, wrong.StatusCode);
        await File.WriteAllBytesAsync(Path.Combine(fixture.UploadRoot, s.WorkerId.ToString(), Path.GetFileName(doc.FileUrl)), "%FDP-unvalidated"u8.ToArray());
        using var invalid = await admin.GetAsync(doc.FileUrl);
        Assert.Equal(HttpStatusCode.NotFound, invalid.StatusCode);
    }

    [Theory]
    [InlineData("fixture.pdf", "%PDF-1.7\nfixture", true)]
    [InlineData("fixture.pdf", "%FDP-not-pdf", false)]
    [InlineData("fixture.png", "%PDF-1.7", false)]
    [InlineData("fixture.webp", "RIFF1234WEBP", false)]
    public async Task UploadValidatesActualBytesAndAllowedExtension(string name, string prefix, bool accepted)
    {
        var s = await fixture.SeedAsync();
        var bytes = System.Text.Encoding.ASCII.GetBytes(prefix);
        using var response = await UploadAsync(s, bytes, name);
        Assert.Equal(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest, response.StatusCode);
        if (accepted)
        {
            var doc = (await response.Content.ReadFromJsonAsync<WorkerDocumentDto>())!;
            using var owner = fixture.Client(s.WorkerToken);
            using var downloaded = await owner.GetAsync(doc.FileUrl);
            Assert.Equal(HttpStatusCode.OK, downloaded.StatusCode);
            Assert.Equal(bytes, await downloaded.Content.ReadAsByteArrayAsync());
        }
        else Assert.Empty(Files(s));
    }

    private string[] Files(Scenario s)
    {
        var directory = Path.Combine(fixture.UploadRoot, s.WorkerId.ToString());
        return Directory.Exists(directory) ? Directory.GetFiles(directory) : [];
    }

    [Fact]
    public void DefaultAndRelativeRootsResolveAgainstContentRoot()
    {
        var contentRoot = Path.Combine(fixture.UploadRoot, "root-policy-fixture");
        Assert.Equal(Path.Combine(contentRoot, "App_Data", "Uploads", "WorkerDocuments"),
            new PrivateUploadPathProvider(contentRoot).GetUploadRoot());
        Assert.Equal(Path.Combine(contentRoot, "private-store"),
            new PrivateUploadPathProvider(contentRoot, "./private-store/").GetUploadRoot());
    }

    private sealed class NonSeekableStream(byte[] bytes) : MemoryStream(bytes)
    {
        public override bool CanSeek => false;
    }

    [Fact]
    public async Task NonSeekableInputIsStagedAndDeliveredWithoutLosingSignatureBytes()
    {
        var s = await fixture.SeedAsync();
        using var scope = fixture.Factory.Services.CreateScope();
        using var stream = new NonSeekableStream(Png);
        var doc = await scope.ServiceProvider.GetRequiredService<IWorkerService>()
            .UploadDocumentAsync(s.WorkerUserId, "Fixture", stream, "fixture.png", Png.Length);
        using var owner = fixture.Client(s.WorkerToken);
        using var response = await owner.GetAsync(doc.FileUrl);
        Assert.Equal(Png, await response.Content.ReadAsByteArrayAsync());
    }

    private sealed class UnavailableDocumentDatabase : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("[WorkerDocuments]")) throw new InvalidOperationException("Fixture document SQL unavailable");
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task UncertainDatabaseOutcomeRetainsPrivateFileForReconciliationWithoutServingIt()
    {
        var s = await fixture.SeedAsync();
        var options = new DbContextOptionsBuilder<KarigorDbContext>().UseSqlServer(fixture.Database.ConnectionString)
            .AddInterceptors(new UnavailableDocumentDatabase()).Options;
        await using var db = new KarigorDbContext(options);
        using var scope = fixture.Factory.Services.CreateScope();
        var service = new WorkerService(db, scope.ServiceProvider.GetRequiredService<IUploadPathProvider>(), NullLogger<WorkerService>.Instance);
        using var stream = new MemoryStream(Png);
        var failure = await Assert.ThrowsAsync<DbUpdateException>(() => service.UploadDocumentAsync(s.WorkerUserId, "Fixture", stream, "fixture.png", Png.Length));
        Assert.IsType<InvalidOperationException>(failure.InnerException);
        var file = Assert.Single(Files(s));
        Assert.EndsWith(".png", file);
        Assert.Equal(Png, await File.ReadAllBytesAsync(file));
        using var owner = fixture.Client(s.WorkerToken);
        using var denied = await owner.GetAsync($"/uploads/worker-documents/{s.WorkerId}/{Path.GetFileName(file)}");
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        Assert.False(await scope.ServiceProvider.GetRequiredService<KarigorDbContext>().WorkerDocuments.AnyAsync(d => d.WorkerId == s.WorkerId));
    }

    [Fact]
    public async Task FiveMiBBoundaryWorksAndOversizeAndExcessiveFieldsAreRejected()
    {
        var s = await fixture.SeedAsync();
        var bytes = new byte[WorkerDocumentLimits.MaxFileSizeBytes];
        Png.CopyTo(bytes, 0);
        using var accepted = await UploadAsync(s, bytes);
        Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        var doc = (await accepted.Content.ReadFromJsonAsync<WorkerDocumentDto>())!;
        using var owner = fixture.Client(s.WorkerToken);
        using var downloaded = await owner.GetAsync(doc.FileUrl);
        Assert.Equal(bytes, await downloaded.Content.ReadAsByteArrayAsync());
        using var rejected = await UploadAsync(s, new byte[WorkerDocumentLimits.MaxFileSizeBytes + 1]);
        Assert.Contains(rejected.StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.RequestEntityTooLarge });
        using var fields = await UploadAsync(s, Png, type: new string('x', 1025));
        Assert.Equal(HttpStatusCode.BadRequest, fields.StatusCode);
        Assert.Single(Files(s));
    }

    [Fact]
    public async Task DatabaseRejectionCompensatesFinalFileAndLeavesNoRow()
    {
        var s = await fixture.SeedAsync();
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        await db.Database.ExecuteSqlRawAsync("ALTER TABLE WorkerDocuments ADD CONSTRAINT CK_Fixture_F7_Reject CHECK (DocumentType <> 'FixtureDbReject')");
        try
        {
            using var rejected = await UploadAsync(s, Png, type: "FixtureDbReject");
            Assert.Equal(HttpStatusCode.InternalServerError, rejected.StatusCode);
            Assert.False(await db.WorkerDocuments.AnyAsync(d => d.WorkerId == s.WorkerId));
            Assert.Empty(Files(s));
        }
        finally { await db.Database.ExecuteSqlRawAsync("ALTER TABLE WorkerDocuments DROP CONSTRAINT CK_Fixture_F7_Reject"); }
    }

    private sealed class InterruptedStream(byte[] bytes) : MemoryStream(bytes)
    {
        private bool readOnce;
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (readOnce) throw new IOException("Fixture interrupted stream");
            readOnce = true;
            return base.ReadAsync(buffer[..Math.Min(buffer.Length, 8)], cancellationToken);
        }
    }

    [Fact]
    public async Task InterruptedWriteAndForgedLengthLeaveNoFileOrRow()
    {
        var s = await fixture.SeedAsync();
        using var scope = fixture.Factory.Services.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<IWorkerService>();
        await using var interrupted = new InterruptedStream(Png);
        await Assert.ThrowsAsync<IOException>(() => service.UploadDocumentAsync(s.WorkerUserId, "Fixture", interrupted, "fixture.png", Png.Length));
        using var forged = new MemoryStream(Png);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.UploadDocumentAsync(s.WorkerUserId, "Fixture", forged, "fixture.png", 1));
        using var oversized = new MemoryStream(new byte[WorkerDocumentLimits.MaxFileSizeBytes + 1]);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.UploadDocumentAsync(s.WorkerUserId, "Fixture", oversized, "fixture.png", 1));
        Assert.Empty(Files(s));
        Assert.False(await scope.ServiceProvider.GetRequiredService<KarigorDbContext>().WorkerDocuments.AnyAsync(d => d.WorkerId == s.WorkerId));
    }

    [Fact]
    public async Task LegacyPublicCopyCannotBypassMvcAuthorization()
    {
        var s = await fixture.SeedAsync();
        var doc = await UploadValidAsync(s);
        var webroot = Path.Combine(fixture.UploadRoot, "public-fixture");
        var legacyDirectory = Path.Combine(webroot, "uploads", "worker-documents", s.WorkerId.ToString());
        Directory.CreateDirectory(legacyDirectory);
        await File.WriteAllBytesAsync(Path.Combine(legacyDirectory, Path.GetFileName(doc.FileUrl)), Png);
        await using var factory = fixture.Factory.WithWebHostBuilder(builder => builder.UseWebRoot(webroot));
        using var anonymous = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        using var denied = await anonymous.GetAsync(doc.FileUrl);
        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        Assert.NotEqual(Png, await denied.Content.ReadAsByteArrayAsync());
        anonymous.DefaultRequestHeaders.Authorization = new("Bearer", s.WorkerToken);
        using var owner = await anonymous.GetAsync(doc.FileUrl);
        Assert.Equal(Png, await owner.Content.ReadAsByteArrayAsync());
    }
}
