using System;
using Karigor.Application.Reviews.DTOs;

namespace Karigor.Application.Marketplace.DTOs;

public class BookingDto
{
    public int Id { get; set; }
    public int ServiceRequestId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal AgreedPrice { get; set; }
    public DateTime ScheduledDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public ReviewDto? Review { get; set; }
}
