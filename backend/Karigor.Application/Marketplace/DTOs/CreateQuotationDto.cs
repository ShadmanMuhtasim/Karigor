using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Marketplace.DTOs;

public class CreateQuotationDto
{
    [Range(1, int.MaxValue)] public int ServiceRequestId { get; set; }
    [Range(typeof(decimal), "0.01", "99999999")] public decimal ProposedPrice { get; set; }
    [StringLength(1000)] public string? Message { get; set; }
}
