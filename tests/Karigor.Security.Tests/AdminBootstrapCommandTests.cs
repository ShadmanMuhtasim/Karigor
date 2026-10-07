using System.Diagnostics;
using Karigor.Api.Administration;
using Karigor.Api.Controllers;

namespace Karigor.Security.Tests;

[Trait("Layer", "Unit"), Trait("Finding", "F2"), Trait("Classification", "GreenBaseline")]
public sealed class AdminBootstrapCommandTests
{
    [Theory]
    [InlineData(false), InlineData(true)]
    public async Task RealCommandRejectsRedirectedInputOrExtraArgumentsWithoutStartingWebServer(bool extraArgument)
    {
        var api = typeof(PaymentsController).Assembly.Location;
        Assert.True(File.Exists(Path.ChangeExtension(api, ".runtimeconfig.json")), "API runtime configuration must accompany its assembly.");
        var start = new ProcessStartInfo(Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet")
        { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        start.ArgumentList.Add(api); start.ArgumentList.Add("bootstrap-admin");
        if (extraArgument) start.ArgumentList.Add("--unsupported");
        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        try { await process.WaitForExitAsync(timeout.Token); }
        finally { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        Assert.Equal(2, process.ExitCode);
        var output = await stdout + await stderr;
        Assert.Contains(extraArgument ? "accepts no arguments" : "interactive terminal", output);
        Assert.DoesNotContain("Starting Karigor.Api", output);
        Assert.DoesNotContain("Now listening", output);
    }

    [Theory]
    [InlineData("missing-email"), InlineData("missing-password"), InlineData("confirmation")]
    public async Task MissingOrMismatchedPromptInputStopsBeforeDatabaseConfiguration(string kind)
    {
        using var output = new StringWriter();
        var secret = Guid.NewGuid().ToString("N") + "Aa1!";
        var input = new InvalidInput(kind, secret);
        Assert.Equal(2, await AdminBootstrapCommand.RunAsync([], input, output: output));
        Assert.Contains("missing or password confirmation", output.ToString());
        Assert.DoesNotContain(secret, output.ToString());
    }
    private sealed record InvalidInput(string Kind, string Secret) : IAdminBootstrapInput
    {
        public bool IsInteractive => true;
        public string ReadEmail() => Kind == "missing-email" ? "" : "fixture@security.invalid";
        public string ReadPassword(bool confirmation) => Kind == "missing-password" ? "" : confirmation && Kind == "confirmation" ? "different" : Secret;
    }
}
