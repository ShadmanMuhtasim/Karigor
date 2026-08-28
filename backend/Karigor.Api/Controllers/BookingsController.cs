using System.Security.Claims;
using Karigor.Application.Marketplace;
using Karigor.Application.Marketplace.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/bookings")]
[Authorize]
public class BookingsController(IMarketplaceService marketplace) : ControllerBase
{
    private string UserId() => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    [HttpPost]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Create([FromBody] CreateBookingDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try { return Ok(await marketplace.CreateBookingAsync(UserId(), dto)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
    }

    [HttpGet("customer")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CustomerHistory()
    {
        try { return Ok(await marketplace.GetCustomerBookingsAsync(UserId())); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
    }

    [HttpGet("worker")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> WorkerHistory()
    {
        try { return Ok(await marketplace.GetWorkerBookingsAsync(UserId())); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Customer,Worker")]
    public async Task<IActionResult> Detail(int id)
    {
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        try { return Ok(await marketplace.GetBookingAsync(UserId(), role, id)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
    }

    [HttpPut("{id:int}/status")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateBookingStatusDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try { return Ok(await marketplace.UpdateBookingStatusAsync(UserId(), id, dto)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
    }

    [HttpPost("{id:int}/verification-code")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> GenerateVerificationCode(int id)
    {
        try { return Ok(await marketplace.GenerateVerificationCodeAsync(UserId(), id)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
    }

    [HttpPost("{id:int}/check-in")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> CheckIn(int id, [FromBody] WorkerCheckInDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try { return Ok(await marketplace.VerifyWorkerCheckInAsync(UserId(), id, dto)); }
        catch (KeyNotFoundException e) { return NotFound(new { error = e.Message }); }
        catch (InvalidOperationException e) { return BadRequest(new { error = e.Message }); }
    }
}
