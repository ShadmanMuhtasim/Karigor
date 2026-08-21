using Karigor.Infrastructure.Models;

namespace Karigor.Application.Auth;

public interface ITokenService
{
    /// <summary>Generate a signed JWT access token for the given user and roles.</summary>
    (string token, DateTime expiry) GenerateAccessToken(ApplicationUser user, IList<string> roles);

    /// <summary>
    /// Generate a cryptographically random refresh token (Base64Url, 96 chars).
    /// The raw value is returned ONCE to be set as a cookie; the caller must hash it before persisting.
    /// </summary>
    string GenerateRefreshToken();

    /// <summary>SHA-256 hash of the raw refresh token, returned as lowercase hex.</summary>
    string HashToken(string rawToken);

    /// <summary>
    /// Constant-time equality check for two token hashes.
    /// </summary>
    bool TokenHashesEqual(string hashA, string hashB);
}
