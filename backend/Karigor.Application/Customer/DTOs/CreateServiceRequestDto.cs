using System;
using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Payload for POST /api/customer/requests.
/// Creates a new service request posted by the customer.
/// </summary>
public class CreateServiceRequestDto
{
    [Required(ErrorMessage = "Category is required.")]
    [Range(1, int.MaxValue, ErrorMessage = "A valid category ID is required.")]
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "Description is required.")]
    [MaxLength(2000, ErrorMessage = "Description cannot exceed 2000 characters.")]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address is required.")]
    [MaxLength(200, ErrorMessage = "Address cannot exceed 200 characters.")]
    public string Address { get; set; } = string.Empty;

    [Range(-90, 90, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    [Range(-180, 180, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    [Required(ErrorMessage = "Preferred date is required.")]
    public DateTime PreferredDate { get; set; }

    public string? PhotoUrls { get; set; }
}

