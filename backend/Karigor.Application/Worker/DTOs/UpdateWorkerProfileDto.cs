using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Body for PUT /api/worker/profile.
/// Only client-editable fields are present — UserId, VerificationStatus,
/// AverageRating, and Id are never accepted from the client.
/// </summary>
public class UpdateWorkerProfileDto
{
    [MaxLength(2000)]
    public string? Bio { get; set; }

    /// <summary>Must be >= 0.</summary>
    [Range(0, double.MaxValue, ErrorMessage = "HourlyRate must be >= 0.")]
    public decimal HourlyRate { get; set; }

    /// <summary>Optional GPS latitude in [-90, 90].</summary>
    [Range(-90, 90, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    /// <summary>Optional GPS longitude in [-180, 180].</summary>
    [Range(-180, 180, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    /// <summary>Service radius in kilometres — must be >= 0.</summary>
    [Range(0, double.MaxValue, ErrorMessage = "ServiceRadiusKm must be >= 0.")]
    public double ServiceRadiusKm { get; set; }
}
