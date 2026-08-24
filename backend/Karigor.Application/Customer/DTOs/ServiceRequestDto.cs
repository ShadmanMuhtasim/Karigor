using System;

namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Returned by GET /api/customer/requests and GET /api/customer/requests/{id}.
/// Full details of a service request.
/// </summary>
public class ServiceRequestDto
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? CategoryIconUrl { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime PreferredDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PhotoUrls { get; set; }
    public int QuotationsCount { get; set; }
}

