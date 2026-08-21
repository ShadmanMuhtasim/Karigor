namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Represents a single availability slot for a worker.
/// DayOfWeek: 0 = Sunday … 6 = Saturday (matches .NET DayOfWeek).
/// </summary>
public class AvailabilitySlotDto
{
    public int    Id        { get; set; }
    public int    DayOfWeek { get; set; }
    public string StartTime { get; set; } = string.Empty;  // "HH:mm"
    public string EndTime   { get; set; } = string.Empty;  // "HH:mm"
}
