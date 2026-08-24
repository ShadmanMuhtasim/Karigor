namespace Karigor.Application.Marketplace.DTOs;

public class AvailableRequestDto
{
    public int Id { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public DateTime PreferredDate { get; set; }
}
