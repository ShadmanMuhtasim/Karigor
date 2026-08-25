using System;

namespace Karigor.Application.Marketplace.DTOs;

public class WorkerQuotationSummaryDto
{
    public int QuotationId { get; set; }
    public int ServiceRequestId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string RequestStatus { get; set; } = string.Empty;
    public decimal MyInitialPrice { get; set; }
    public decimal LatestPrice { get; set; }
    public string LatestStatus { get; set; } = string.Empty; // "Pending", "Countered", "Accepted", "Rejected"
    public string LatestProposedBy { get; set; } = string.Empty; // "Worker" or "Customer"
    public string? LatestMessage { get; set; }
    public int NegotiationStepsCount { get; set; }
    public DateTime PreferredDate { get; set; }
}
