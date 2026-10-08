using System.Text;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using System.Buffers.Text;

namespace Karigor.Application.Auth;

public sealed class PasswordResetService(UserManager<ApplicationUser> users, RefreshSessionService sessions)
{
    public const string GenericMessage = "If an account exists for that email, password reset instructions have been sent.";
    public const string InvalidLink = "This reset link is invalid or has expired. Please request a new link.";

    public async Task<(bool Success, string Message)> ResetAsync(string email, string token, string password, string confirmation)
    {
        if (password != confirmation) return (false, "The passwords do not match.");
        string decoded;
        try { decoded = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(token)); }
        catch (FormatException) { return (false, InvalidLink); }
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null) return (false, InvalidLink);
        var result = await sessions.ResetPasswordAsync(user.Id, decoded, password);
        if (result.Succeeded) return (true, "Your password has been reset. Please sign in again.");
        // Only allowlisted policy guidance reaches the caller; Identity descriptions never do.
        if (result.Errors.Any(e => e.Code.StartsWith("Password", StringComparison.Ordinal)))
            return (false, "Use at least 8 characters, including an uppercase letter, a lowercase letter and a number.");
        return (false, InvalidLink);
    }
}
