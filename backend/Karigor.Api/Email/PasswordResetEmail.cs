using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Channels;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace Karigor.Api.Email;

public interface IPasswordResetEmailSender
{
    Task SendAsync(string email, string link, CancellationToken cancellation);
}

public sealed class SmtpPasswordResetEmailSender(IConfiguration config) : IPasswordResetEmailSender
{
    public async Task SendAsync(string email, string link, CancellationToken cancellation)
    {
        var host = config["Email:SmtpHost"] ?? throw new InvalidOperationException("Email is not configured.");
        // Require STARTTLS; never silently send credentials or reset links over plaintext SMTP.
        if (!config.GetValue("Email:UseSsl", true)) throw new InvalidOperationException("Email requires TLS.");
        using var client = new SmtpClient(host, config.GetValue("Email:SmtpPort", 587))
        {
            EnableSsl = true, UseDefaultCredentials = false,
            Credentials = new NetworkCredential(config["Email:Username"], config["Email:Password"]),
            Timeout = 15000
        };
        using var message = new MailMessage
        {
            From = new MailAddress(config["Email:FromAddress"] ?? throw new InvalidOperationException("Email is not configured."),
                config["Email:FromName"] ?? "Karigor"),
            Subject = "Reset your Karigor password",
            Body = $"A password reset was requested for your Karigor account.\n\nReset your password:\n{link}\n\nThis link expires in 20 minutes and can only be used once. If you did not request this, ignore this email. Your password will remain unchanged.",
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(email));
        await client.SendMailAsync(message, cancellation);
    }
}

// The HTTP path queues only an address, with identical work for known and unknown accounts.
// Tokens are generated inside a scoped worker, never placed in API responses or logs.
public sealed class PasswordResetEmailQueue : IDisposable
{
    private readonly Channel<string> queue = Channel.CreateBounded<string>(new BoundedChannelOptions(100)
    { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });
    private readonly MemoryCache cooldowns = new(new MemoryCacheOptions { SizeLimit = 10000 });
    private readonly object gate = new();
    public ChannelReader<string> Reader => queue.Reader;

    public void Enqueue(string? value)
    {
        var email = value?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 256 || !new EmailAddressAttribute().IsValid(email)) return;
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(email.ToUpperInvariant())));
        lock (gate)
        {
            if (cooldowns.TryGetValue(key, out _)) return;
            if (queue.Writer.TryWrite(email))
                cooldowns.Set(key, true, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5), Size = 1 });
        }
    }
    public void Dispose() { queue.Writer.TryComplete(); cooldowns.Dispose(); }
}

public sealed class PasswordResetEmailWorker(PasswordResetEmailQueue queue, IServiceScopeFactory scopes,
    IConfiguration config, ILogger<PasswordResetEmailWorker> logger) : BackgroundService
{
    public static string BuildLink(string baseUrl, string email, string token)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var origin) || origin.Scheme != "https" ||
            !string.IsNullOrEmpty(origin.UserInfo) || origin.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(origin.Query) || !string.IsNullOrEmpty(origin.Fragment))
            throw new InvalidOperationException("An HTTPS frontend origin is required.");
        return origin.GetLeftPart(UriPartial.Authority) + "/reset-password#email=" + Uri.EscapeDataString(email) +
            "&token=" + WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var email in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var user = await users.FindByEmailAsync(email);
                if (user is null) continue;
                var token = await users.GeneratePasswordResetTokenAsync(user);
                var link = BuildLink(config["Email:ClientBaseUrl"] ?? "https://karigor.runasp.net", user.Email!, token);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(20));
                await scope.ServiceProvider.GetRequiredService<IPasswordResetEmailSender>().SendAsync(user.Email!, link, timeout.Token);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                // SMTP errors may contain recipient/provider data. Log no exception, link or credential.
                logger.LogError("Password reset email delivery failed. Check private email configuration and provider availability.");
            }
        }
    }
}
