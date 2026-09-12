using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Auth.DTOs;

public class GoogleLoginDto
{
    [Required]
    public string IdToken { get; set; } = null!;

    /// <summary>
    /// Desired role for new account registration ("Customer" by default).
    /// </summary>
    public string? Role { get; set; }
}
