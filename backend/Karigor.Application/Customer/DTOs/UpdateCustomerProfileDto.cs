using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Payload for PUT /api/customer/profile.
/// Updates the customer's editable profile fields.
/// </summary>
public class UpdateCustomerProfileDto
{
    [Required(ErrorMessage = "Full name is required.")]
    [MaxLength(100, ErrorMessage = "Full name cannot exceed 100 characters.")]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(200, ErrorMessage = "Address cannot exceed 200 characters.")]
    public string? Address { get; set; }

    public string? ProfileImageUrl { get; set; }
}

