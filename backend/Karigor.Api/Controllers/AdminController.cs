using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Admin;
using Karigor.Application.Admin.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

/// <summary>
/// Administrative management endpoints.
/// Strictly restricted to users with the Admin role.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    // -------------------------------------------------------------------------
    // 9.9 Analytics & KPIs
    // -------------------------------------------------------------------------
    [HttpGet("stats")]
    [ProducesResponseType(typeof(AdminStatsDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _adminService.GetPlatformStatsAsync();
        return Ok(stats);
    }

    // -------------------------------------------------------------------------
    // 9.2 & 9.3 Worker Verification Queue
    // -------------------------------------------------------------------------
    [HttpGet("workers/pending")]
    [ProducesResponseType(typeof(List<PendingWorkerDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingWorkers(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var workers = await _adminService.GetPendingWorkersAsync(status, search);
        return Ok(workers);
    }

    [HttpPut("workers/{id}/verify")]
    [ProducesResponseType(typeof(PendingWorkerDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyWorker(int id, [FromBody] VerifyWorkerDto dto)
    {
        var result = await _adminService.VerifyWorkerAsync(id, dto);
        return Ok(result);
    }

    // -------------------------------------------------------------------------
    // 9.4 & 9.5 User Management
    // -------------------------------------------------------------------------
    [HttpGet("users")]
    [ProducesResponseType(typeof(List<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? role = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? isSuspended = null)
    {
        var users = await _adminService.GetUsersAsync(role, search, isSuspended);
        return Ok(users);
    }

    [HttpPut("users/{id}/suspend")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ToggleUserSuspension(string id, [FromBody] UserSuspensionDto dto)
    {
        var user = await _adminService.ToggleUserSuspensionAsync(id, dto);
        return Ok(user);
    }

    // -------------------------------------------------------------------------
    // 9.6 Booking Monitoring
    // -------------------------------------------------------------------------
    [HttpGet("bookings")]
    [ProducesResponseType(typeof(List<AdminBookingDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBookings(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var bookings = await _adminService.GetBookingsAsync(status, search);
        return Ok(bookings);
    }

    // -------------------------------------------------------------------------
    // 9.7 & 9.8 Review Moderation
    // -------------------------------------------------------------------------
    [HttpGet("reviews")]
    [ProducesResponseType(typeof(List<AdminReviewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReviews(
        [FromQuery] string? search = null,
        [FromQuery] int? minRating = null,
        [FromQuery] int? maxRating = null)
    {
        var reviews = await _adminService.GetReviewsAsync(search, minRating, maxRating);
        return Ok(reviews);
    }

    [HttpPut("reviews/{id}/moderate")]
    [ProducesResponseType(typeof(AdminReviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ModerateReview(int id, [FromBody] ModerateReviewDto dto)
    {
        var review = await _adminService.ModerateReviewAsync(id, dto);
        return Ok(review);
    }

    [HttpDelete("reviews/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteReview(int id)
    {
        await _adminService.DeleteReviewAsync(id);
        return NoContent();
    }

    // -------------------------------------------------------------------------
    // 9.10 - 9.13 Service Categories CRUD
    // -------------------------------------------------------------------------
    [HttpGet("categories")]
    [ProducesResponseType(typeof(List<AdminCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _adminService.GetCategoriesAsync();
        return Ok(categories);
    }

    [HttpPost("categories")]
    [ProducesResponseType(typeof(AdminCategoryDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryDto dto)
    {
        var category = await _adminService.CreateCategoryAsync(dto);
        return StatusCode(StatusCodes.Status201Created, category);
    }

    [HttpPut("categories/{id}")]
    [ProducesResponseType(typeof(AdminCategoryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryDto dto)
    {
        var category = await _adminService.UpdateCategoryAsync(id, dto);
        return Ok(category);
    }

    [HttpDelete("categories/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        await _adminService.DeleteCategoryAsync(id);
        return NoContent();
    }
}
