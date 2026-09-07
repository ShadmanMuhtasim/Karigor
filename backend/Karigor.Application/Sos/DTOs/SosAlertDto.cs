using System;

namespace Karigor.Application.Sos.DTOs;

public class SosAlertDto
{
    public int Id { get; set; }
    public int BookingId { get; set; }

    // Customer info
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public string? CustomerEmail { get; set; }

    // Worker info
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string? WorkerPhone { get; set; }
    public string? WorkerEmail { get; set; }

    // Service & Booking context
    public string ServiceCategoryName { get; set; } = string.Empty;
    public string ServiceAddress { get; set; } = string.Empty;
    public decimal AgreedPrice { get; set; }
    public DateTime ScheduledDate { get; set; }
    public string BookingStatus { get; set; } = string.Empty;

    // Alert state
    public DateTime TriggeredAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? AdminNotes { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolvedByAdminId { get; set; }
    public string? ResolvedByAdminEmail { get; set; }
}
