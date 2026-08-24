using System.Collections.Generic;
using Karigor.Application.Worker.DTOs;

namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Returned by GET /api/customer/workers/{id}.
/// Full public profile of a worker including availability and skills.
/// </summary>
public class WorkerPublicDetailDto
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public decimal HourlyRate { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double ServiceRadiusKm { get; set; }
    public string VerificationStatus { get; set; } = string.Empty;
    public double AverageRating { get; set; }
    public List<SkillDto> Skills { get; set; } = new();
    public List<AvailabilitySlotDto> Availability { get; set; } = new();
}

