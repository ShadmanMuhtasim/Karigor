namespace Karigor.Application.Marketplace.DTOs;

public class QuotationDto
{
    public int Id { get; set; }
    public int ServiceRequestId { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string? WorkerBio { get; set; }
    public double AverageRating { get; set; }
    public decimal ProposedPrice { get; set; }
    public string? Message { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? ParentQuotationId { get; set; }
    public string ProposedBy { get; set; } = "Worker"; // "Worker" or "Customer"
    public int NegotiationDepth { get; set; } = 0;
}
