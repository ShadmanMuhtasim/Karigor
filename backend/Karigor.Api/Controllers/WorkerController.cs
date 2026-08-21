using Karigor.Application.Worker;
using Karigor.Application.Worker.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Karigor.Api.Controllers;

/// <summary>
/// Worker module endpoints.
/// All routes require an authenticated JWT with role = "Worker".
/// The WorkerProfile is resolved server-side from the JWT sub claim —
/// no client-supplied workerId/profileId is accepted or trusted.
/// </summary>
[ApiController]
[Route("api/worker")]
[Authorize(Roles = "Worker")]
public class WorkerController : ControllerBase
{
    private readonly IWorkerService _workerService;

    public WorkerController(IWorkerService workerService)
    {
        _workerService = workerService;
    }

    // ── Helper: extract authenticated user ID from JWT sub ───────────────────
    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    // =========================================================================
    // Profile
    // =========================================================================

    /// <summary>GET /api/worker/profile — retrieve the authenticated worker's profile.</summary>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(WorkerProfileDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetProfile()
    {
        try
        {
            var dto = await _workerService.GetProfileAsync(GetUserId());
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>PUT /api/worker/profile — update editable profile fields.</summary>
    [HttpPut("profile")]
    [ProducesResponseType(typeof(WorkerProfileDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateWorkerProfileDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var result = await _workerService.UpdateProfileAsync(GetUserId(), dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Skills
    // =========================================================================

    /// <summary>GET /api/worker/skills — list skills assigned to the authenticated worker.</summary>
    [HttpGet("skills")]
    [ProducesResponseType(typeof(List<SkillDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetSkills()
    {
        try
        {
            var skills = await _workerService.GetSkillsAsync(GetUserId());
            return Ok(skills);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>POST /api/worker/skills — assign one or more categories as worker skills.</summary>
    [HttpPost("skills")]
    [ProducesResponseType(typeof(List<SkillDto>), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> AddSkills([FromBody] AddSkillsDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var skills = await _workerService.AddSkillsAsync(GetUserId(), dto);
            return StatusCode(201, skills);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    /// <summary>DELETE /api/worker/skills/{categoryId} — unassign a skill from the authenticated worker.</summary>
    [HttpDelete("skills/{categoryId:int}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> RemoveSkill(int categoryId)
    {
        try
        {
            await _workerService.RemoveSkillAsync(GetUserId(), categoryId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Availability
    // =========================================================================

    /// <summary>GET /api/worker/availability — retrieve the authenticated worker's schedule.</summary>
    [HttpGet("availability")]
    [ProducesResponseType(typeof(List<AvailabilitySlotDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetAvailability()
    {
        try
        {
            var slots = await _workerService.GetAvailabilityAsync(GetUserId());
            return Ok(slots);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>PUT /api/worker/availability — atomically replace the full weekly schedule.</summary>
    [HttpPut("availability")]
    [ProducesResponseType(typeof(List<AvailabilitySlotDto>), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> SetAvailability([FromBody] SetAvailabilityDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var slots = await _workerService.SetAvailabilityAsync(GetUserId(), dto);
            return Ok(slots);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Documents
    // =========================================================================

    /// <summary>GET /api/worker/documents — list uploaded documents for the authenticated worker.</summary>
    [HttpGet("documents")]
    [ProducesResponseType(typeof(List<WorkerDocumentDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDocuments()
    {
        try
        {
            var docs = await _workerService.GetDocumentsAsync(GetUserId());
            return Ok(docs);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>POST /api/worker/documents — upload a verification document (multipart form).</summary>
    [HttpPost("documents")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(WorkerDocumentDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UploadDocument(
        [FromForm] string documentType,
        IFormFile file)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file was uploaded." });

        try
        {
            // Unpack IFormFile here (API layer) — Application layer receives a plain Stream
            await using var stream = file.OpenReadStream();
            var doc = await _workerService.UploadDocumentAsync(
                GetUserId(),
                documentType,
                stream,
                file.FileName,
                file.Length);
            return StatusCode(201, doc);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Dashboard Stats
    // =========================================================================

    /// <summary>GET /api/worker/dashboard/stats — computed summary for the worker dashboard.</summary>
    [HttpGet("dashboard/stats")]
    [ProducesResponseType(typeof(WorkerDashboardStatsDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            var stats = await _workerService.GetDashboardStatsAsync(GetUserId());
            return Ok(stats);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}
