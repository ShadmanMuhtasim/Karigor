using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Body for POST /api/worker/skills.
/// Accepts one or more category IDs to assign to the worker.
/// </summary>
public class AddSkillsDto
{
    [Required]
    [MinLength(1, ErrorMessage = "Provide at least one CategoryId.")]
    public List<int> CategoryIds { get; set; } = new();
}
