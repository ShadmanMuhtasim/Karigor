using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Customer;
using Karigor.Application.Customer.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

/// <summary>
/// Customer module endpoints.
/// All routes require an authenticated JWT with role = "Customer".
/// The CustomerProfile is resolved server-side from the JWT sub claim —
/// no client-supplied customerId is accepted or trusted.
/// </summary>
[ApiController]
[Route("api/customer")]
[Authorize(Roles = "Customer")]
public class CustomerController : ControllerBase
{
    private readonly ICustomerService _customerService;

    public CustomerController(ICustomerService customerService)
    {
        _customerService = customerService;
    }

    // ── Helper: extract authenticated user ID from JWT sub ───────────────────
    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    // =========================================================================
    // Profile
    // =========================================================================

    /// <summary>GET /api/customer/profile — retrieve authenticated customer's profile.</summary>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(CustomerProfileDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetProfile()
    {
        try
        {
            var profile = await _customerService.GetProfileAsync(GetUserId());
            return Ok(profile);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>PUT /api/customer/profile — update editable customer profile fields.</summary>
    [HttpPut("profile")]
    [ProducesResponseType(typeof(CustomerProfileDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCustomerProfileDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var updated = await _customerService.UpdateProfileAsync(GetUserId(), dto);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Service Requests
    // =========================================================================

    /// <summary>POST /api/customer/requests — create a new service request.</summary>
    [HttpPost("requests")]
    [ProducesResponseType(typeof(ServiceRequestDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> CreateServiceRequest([FromBody] CreateServiceRequestDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var request = await _customerService.CreateServiceRequestAsync(GetUserId(), dto);
            return StatusCode(201, request);
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

    /// <summary>GET /api/customer/requests — list authenticated customer's service requests with optional status filter.</summary>
    [HttpGet("requests")]
    [ProducesResponseType(typeof(List<ServiceRequestDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetServiceRequests([FromQuery] string? status)
    {
        try
        {
            var requests = await _customerService.GetServiceRequestsAsync(GetUserId(), status);
            return Ok(requests);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>GET /api/customer/requests/{id} — retrieve a single service request by ID.</summary>
    [HttpGet("requests/{id:int}")]
    [ProducesResponseType(typeof(ServiceRequestDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetServiceRequestById(int id)
    {
        try
        {
            var request = await _customerService.GetServiceRequestByIdAsync(GetUserId(), id);
            return Ok(request);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Worker Discovery
    // =========================================================================

    /// <summary>GET /api/customer/workers/search — search and discover workers by category, location, rating, keyword.</summary>
    [HttpGet("workers/search")]
    [ProducesResponseType(typeof(List<WorkerSearchResultDto>), 200)]
    public async Task<IActionResult> SearchWorkers([FromQuery] WorkerSearchParamsDto query)
    {
        var results = await _customerService.SearchWorkersAsync(query);
        return Ok(results);
    }

    /// <summary>GET /api/customer/workers/{id} — view public profile and availability of a specific worker.</summary>
    [HttpGet("workers/{id:int}")]
    [ProducesResponseType(typeof(WorkerPublicDetailDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetWorkerProfile(int id)
    {
        try
        {
            var worker = await _customerService.GetWorkerPublicProfileAsync(id);
            return Ok(worker);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // Dashboard Stats
    // =========================================================================

    /// <summary>GET /api/customer/dashboard/stats — summary metrics for the customer dashboard.</summary>
    [HttpGet("dashboard/stats")]
    [ProducesResponseType(typeof(CustomerDashboardStatsDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            var stats = await _customerService.GetDashboardStatsAsync(GetUserId());
            return Ok(stats);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
}

