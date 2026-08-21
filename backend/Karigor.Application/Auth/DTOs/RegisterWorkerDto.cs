using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Auth.DTOs;

public class RegisterWorkerDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = null!;

    [Required, MinLength(8)]
    public string Password { get; set; } = null!;

    [Required, MaxLength(100)]
    public string FullName { get; set; } = null!;

    public string? Bio { get; set; }

    [Range(0, 10000)]
    public decimal HourlyRate { get; set; }

    /// <summary>
    /// List of ServiceCategory IDs this worker offers.
    /// At least one is required.
    /// </summary>
    [Required, MinLength(1)]
    public List<int> CategoryIds { get; set; } = [];
}
