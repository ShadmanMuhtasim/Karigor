using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Reviews.DTOs;

public class CreateReviewDto
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "A valid booking ID is required.")]
    public int BookingId { get; set; }

    [Required]
    [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5 stars.")]
    public int Rating { get; set; }

    [MaxLength(1000, ErrorMessage = "Comment cannot exceed 1000 characters.")]
    public string? Comment { get; set; }
}
