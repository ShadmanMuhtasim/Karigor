using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

/// <summary>
/// Test endpoint for role-based authorization verification.
/// Used in Milestone 2 verification suite:
///   - Customer token -> 403 Forbidden (negative test)
///   - Worker token   -> 200 OK       (positive test)
/// </summary>
[ApiController]
[Route("api/worker-only")]
public class WorkerOnlyController : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Worker")]
    public IActionResult Get()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Ok(new
        {
            message = "Worker-only endpoint reached.",
            userId
        });
    }
}
