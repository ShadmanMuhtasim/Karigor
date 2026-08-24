namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Query parameters for GET /api/customer/workers/search.
/// </summary>
public class WorkerSearchParamsDto
{
    public int? CategoryId { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusKm { get; set; }
    public double? MinRating { get; set; }
    public string? SearchTerm { get; set; }
}

