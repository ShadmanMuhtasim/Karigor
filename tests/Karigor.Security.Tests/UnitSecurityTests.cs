using Karigor.Application.Worker;
using Karigor.Security.Tests.Infrastructure;

namespace Karigor.Security.Tests;

[Trait("Layer", "Unit")]
public sealed class UnitSecurityTests
{
    [Fact, Trait("Finding", "F7"), Trait("Classification", "ExpectedFailRegression")]
    public void ValidPdfSignatureIsAccepted()
    {
        using var stream = new MemoryStream("%PDF-1.7\nfixture"u8.ToArray());
        Assert.True(FileValidationService.ValidateStream(stream, "pdf", out _),
            "F7_VALID_PDF: a valid PDF signature must be accepted.");
    }

    [Fact, Trait("Finding", "F7"), Trait("Classification", "ExpectedFailRegression")]
    public void InvalidFdpSignatureIsRejected()
    {
        using var stream = new MemoryStream("%FDP-not-a-pdf"u8.ToArray());
        Assert.False(FileValidationService.ValidateStream(stream, "pdf", out _),
            "F7_INVALID_FDP: the incorrect %FDP prefix must be rejected.");
    }

    [Fact, Trait("Finding", "F7"), Trait("Classification", "GreenBaseline")]
    public void ValidPngSignatureIsAcceptedAndStreamPositionIsPreserved()
    {
        using var stream = new MemoryStream([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
        stream.Position = 3;
        Assert.True(FileValidationService.ValidateStream(stream, "png", out _));
        Assert.Equal(3, stream.Position);
    }

    [Fact, Trait("Classification", "GreenBaseline")]
    public void SqlFixtureRejectsRemoteServersAndApplicationDatabases()
    {
        Assert.Throws<InvalidOperationException>(() =>
            DisposableSqlDatabase.ValidateAdminConnection("Server=production.example;Database=master;Integrated Security=true"));
        Assert.Throws<InvalidOperationException>(() =>
            DisposableSqlDatabase.ValidateAdminConnection(@"Server=.\SQLEXPRESS;Database=KarigorDev;Integrated Security=true"));
    }
}
