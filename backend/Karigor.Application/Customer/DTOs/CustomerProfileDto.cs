namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Returned by GET /api/customer/profile.
/// Contains customer profile details and contact information.
/// </summary>
public class CustomerProfileDto
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? ProfileImageUrl { get; set; }
}

