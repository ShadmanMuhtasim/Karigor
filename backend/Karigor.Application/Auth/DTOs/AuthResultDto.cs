namespace Karigor.Application.Auth.DTOs;

/// <summary>
/// Returned from login and refresh endpoints.
/// The refresh token is delivered as an httpOnly cookie — never in this body.
/// </summary>
public class AuthResultDto
{
    public string AccessToken { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Role { get; set; } = null!;
    /// <summary>UTC expiry of the access token.</summary>
    public DateTime AccessTokenExpiry { get; set; }
}
