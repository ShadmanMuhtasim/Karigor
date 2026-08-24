using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Marketplace.DTOs;

public class CreateBookingDto
{
    [Range(1, int.MaxValue)] public int QuotationId { get; set; }
}
