using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Auth.DTOs;

public class RegisterCustomerDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = null!;

    [Required, MinLength(8)]
    public string Password { get; set; } = null!;

    [Required, MaxLength(100)]
    public string FullName { get; set; } = null!;

    [MaxLength(200)]
    public string? Address { get; set; }
}
