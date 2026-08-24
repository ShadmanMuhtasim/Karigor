using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Marketplace.DTOs;

public class CounterQuotationDto
{
    [Range(typeof(decimal), "0.01", "99999999")] public decimal ProposedPrice { get; set; }
    [StringLength(1000)] public string? Message { get; set; }
}
