using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Marketplace.DTOs;

public class UpdateBookingStatusDto
{
    [Required]
    [RegularExpression("^(InProgress|Completed|Cancelled)$", ErrorMessage = "Status must be InProgress, Completed, or Cancelled.")]
    public string Status { get; set; } = string.Empty;
}
