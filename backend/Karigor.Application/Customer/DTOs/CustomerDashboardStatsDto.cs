namespace Karigor.Application.Customer.DTOs;

/// <summary>
/// Returned by GET /api/customer/dashboard/stats.
/// Summary metrics for the customer dashboard overview.
/// </summary>
public class CustomerDashboardStatsDto
{
    public int TotalRequests { get; set; }
    public int ActiveRequests { get; set; }
    public int CompletedRequests { get; set; }
    public int TotalBookings { get; set; }
}

