namespace Karigor.Application.Auth;

/// <summary>
/// Domain exception representing expected user validation issues during authentication or registration
/// (e.g. duplicate email, invalid password complexity, missing required categories).
/// Surfaced as HTTP 409 Conflict with the clean validation message.
/// </summary>
public class AuthValidationException : Exception
{
    public AuthValidationException(string message) : base(message)
    {
    }

    public AuthValidationException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
