using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Api.Controllers;

/// <summary>
/// Categories endpoints for Service Categories.
/// Returns seeded data from KarigorDev.
/// </summary>
[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly KarigorDbContext _db;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(KarigorDbContext db, ILogger<CategoriesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Returns all service categories seeded in 002_seed_categories.sql.
    /// GET /api/categories
    /// </summary>
    [HttpGet("")]
    [ProducesResponseType(typeof(IEnumerable<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories(CancellationToken ct)
    {
        _logger.LogInformation("GET /api/categories called");

        var categories = await _db.ServiceCategories
            .OrderBy(c => c.Id)
            .Select(c => new CategoryDto(c.Id, c.Name, c.IconUrl))
            .ToListAsync(ct);

        return Ok(categories);
    }

    [HttpGet("throw")]
    public IActionResult Throw() => throw new Exception("Controlled failure test");
}

/// <summary>Simple read-only DTO for a service category.</summary>
public record CategoryDto(int Id, string Name, string? IconUrl);
