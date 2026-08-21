namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Returned by GET /api/worker/dashboard/stats.
/// All values are computed from real database data — none are hard-coded.
/// </summary>
public class WorkerDashboardStatsDto
{
    public string VerificationStatus { get; set; } = string.Empty;

    /// <summary>Number of distinct service category skills assigned to this worker.</summary>
    public int TotalSkills { get; set; }

    /// <summary>
    /// Profile completion percentage (0–100), calculated as:
    ///   Fields checked: Bio (20%), HourlyRate>0 (20%),
    ///   Latitude+Longitude set (20%), at least 1 skill (20%),
    ///   at least 1 availability slot (20%).
    ///   Each filled field contributes 20%, total = 100%.
    /// </summary>
    public int ProfileCompletionPercentage { get; set; }

    /// <summary>
    /// "Available" if the worker has at least one availability slot, otherwise "Not Set".
    /// </summary>
    public string AvailabilityStatus { get; set; } = string.Empty;

    public double AverageRating { get; set; }
}
