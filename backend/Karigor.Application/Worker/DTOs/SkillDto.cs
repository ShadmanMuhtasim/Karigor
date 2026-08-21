namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Represents a single service category assigned to a worker as a skill.
/// </summary>
public class SkillDto
{
    public int    CategoryId   { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? IconUrl     { get; set; }
}
