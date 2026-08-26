using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Reviews.DTOs;

public class WorkerReviewResponseDto
{
    [Required(ErrorMessage = "Response message is required.")]
    [MaxLength(1000, ErrorMessage = "Response cannot exceed 1000 characters.")]
    public string Response { get; set; } = string.Empty;
}
