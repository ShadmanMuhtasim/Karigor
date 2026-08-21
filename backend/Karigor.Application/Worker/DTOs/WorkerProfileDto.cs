namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Returned by GET /api/worker/profile.
/// Contains the worker's editable profile fields plus read-only summary data.
/// </summary>
public class WorkerProfileDto
{
    public int    Id                 { get; set; }
    public string Email              { get; set; } = string.Empty;
    public string? Bio               { get; set; }
    public decimal HourlyRate        { get; set; }
    public double? Latitude          { get; set; }
    public double? Longitude         { get; set; }
    public double ServiceRadiusKm    { get; set; }
    public string VerificationStatus { get; set; } = string.Empty;
    public double AverageRating      { get; set; }

    /// <summary>Categories the worker has assigned as skills.</summary>
    public List<SkillDto> Skills     { get; set; } = new();
}
