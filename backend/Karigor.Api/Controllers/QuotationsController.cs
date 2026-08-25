using System.Security.Claims;
using Karigor.Application.Marketplace;
using Karigor.Application.Marketplace.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/quotations")]
[Authorize]
public class QuotationsController(IMarketplaceService marketplace) : ControllerBase
{
    private string UserId() => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    [HttpPost]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> Create([FromBody] CreateQuotationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try { return StatusCode(201, await marketplace.CreateQuotationAsync(UserId(), dto)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("request/{requestId:int}/details")]
    public async Task<IActionResult> RequestDetails(int requestId)
    {
        try { return Ok(await marketplace.GetServiceRequestDetailsAsync(UserId(), requestId)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("request/{requestId:int}")]
    public async Task<IActionResult> ForRequest(int requestId)
    {
        try { return Ok(await marketplace.GetRequestQuotationsAsync(UserId(), requestId)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("worker")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> WorkerQuotations()
    {
        try { return Ok(await marketplace.GetWorkerQuotationsAsync(UserId())); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpGet("available-requests")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> AvailableRequests()
    {
        try { return Ok(await marketplace.GetAvailableRequestsAsync(UserId())); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost("{id:int}/accept")]
    public async Task<IActionResult> Accept(int id)
    {
        try { return Ok(await marketplace.AcceptQuotationAsync(UserId(), id)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [HttpPost("{id:int}/counter")]
    public async Task<IActionResult> Counter(int id, [FromBody] CounterQuotationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try { return StatusCode(201, await marketplace.CounterQuotationAsync(UserId(), id, dto)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }
}
