using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Location;
using Karigor.Application.Location.DTOs;
using Karigor.Application.Worker.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
public class LocationController : ControllerBase
{
    private readonly ILocationService _locationService;

    public LocationController(ILocationService locationService)
    {
        _locationService = locationService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    // =========================================================================
    // 6.1 GET /api/workers/nearby — find workers within radius
    // =========================================================================
    [HttpGet("api/workers/nearby")]
    [HttpGet("api/location/workers/nearby")]
    [ProducesResponseType(typeof(List<NearbyWorkerDto>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> GetNearbyWorkers([FromQuery] NearbyWorkerParamsDto query)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var workers = await _locationService.GetNearbyWorkersAsync(query);
        return Ok(workers);
    }

    // =========================================================================
    // 6.2 PUT /api/worker/location — worker updates latitude/longitude/radius
    // =========================================================================
    [HttpPut("api/worker/location")]
    [HttpPut("api/location/worker")]
    [Authorize(Roles = "Worker")]
    [ProducesResponseType(typeof(WorkerProfileDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateWorkerLocation([FromBody] UpdateWorkerLocationDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var profile = await _locationService.UpdateWorkerLocationAsync(GetUserId(), dto);
            return Ok(profile);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // 6.3 GET /api/requests/nearby — find nearby service requests for worker
    // =========================================================================
    [HttpGet("api/requests/nearby")]
    [HttpGet("api/worker/requests/nearby")]
    [HttpGet("api/location/requests/nearby")]
    [Authorize(Roles = "Worker")]
    [ProducesResponseType(typeof(List<NearbyRequestDto>), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetNearbyRequests([FromQuery] NearbyRequestParamsDto? query)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var requests = await _locationService.GetNearbyRequestsForWorkerAsync(GetUserId(), query);
            return Ok(requests);
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
}
