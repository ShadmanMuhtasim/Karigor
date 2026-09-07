using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Sos.DTOs;

public class UpdateSosStatusDto
{
    [Required]
    [RegularExpression("^(Open|Contacted|Resolved|Escalated)$", ErrorMessage = "Status must be Open, Contacted, Resolved, or Escalated.")]
    public string Status { get; set; } = string.Empty;

    public string? AdminNotes { get; set; }
}
