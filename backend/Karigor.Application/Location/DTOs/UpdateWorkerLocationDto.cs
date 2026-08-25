using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Location.DTOs;

public class UpdateWorkerLocationDto
{
    [Required]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double Latitude { get; set; }

    [Required]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double Longitude { get; set; }

    [Range(0.5, 200.0, ErrorMessage = "Service radius must be between 0.5 and 200 km.")]
    public double? ServiceRadiusKm { get; set; }
}
