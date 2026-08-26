using System;

namespace Karigor.Application.Reviews.DTOs;

public class ReviewDto
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerProfileImageUrl { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string? WorkerResponse { get; set; }
    public DateTime BookingDate { get; set; }
}
