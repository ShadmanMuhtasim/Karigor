using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Represents a single availability window inside the PUT body.
/// </summary>
public class SetAvailabilitySlotDto
{
    /// <summary>0 = Sunday … 6 = Saturday.</summary>
    [Range(0, 6, ErrorMessage = "DayOfWeek must be between 0 (Sunday) and 6 (Saturday).")]
    public int DayOfWeek { get; set; }

    /// <summary>Start time string in "HH:mm" format.</summary>
    [Required]
    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)$", ErrorMessage = "StartTime must be in HH:mm format.")]
    public string StartTime { get; set; } = string.Empty;

    /// <summary>End time string in "HH:mm" format.</summary>
    [Required]
    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)$", ErrorMessage = "EndTime must be in HH:mm format.")]
    public string EndTime { get; set; } = string.Empty;
}

/// <summary>
/// Body for PUT /api/worker/availability.
/// Replaces the worker's full availability schedule atomically.
/// </summary>
public class SetAvailabilityDto
{
    [Required]
    public List<SetAvailabilitySlotDto> Slots { get; set; } = new();
}
