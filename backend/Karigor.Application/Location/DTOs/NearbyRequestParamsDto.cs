using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Location.DTOs;

public class NearbyRequestParamsDto
{
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90.")]
    public double? Latitude { get; set; }

    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180.")]
    public double? Longitude { get; set; }

    [Range(0.1, 500.0, ErrorMessage = "Radius must be between 0.1 and 500 km.")]
    public double? RadiusKm { get; set; }

    public int? CategoryId { get; set; }
}
