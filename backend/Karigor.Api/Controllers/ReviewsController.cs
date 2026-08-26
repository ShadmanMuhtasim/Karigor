using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Reviews;
using Karigor.Application.Reviews.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    private string? GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    /// <summary>
    /// 8.2 Customer submits rating and review for a completed booking
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto dto)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        try
        {
            var result = await _reviewService.CreateReviewAsync(userId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// 8.3 Get all reviews and rating distribution for a worker (public)
    /// </summary>
    [HttpGet("worker/{workerId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetWorkerReviews(int workerId)
    {
        try
        {
            var result = await _reviewService.GetWorkerReviewsAsync(workerId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// 8.4 Get review for a specific booking
    /// </summary>
    [HttpGet("booking/{bookingId:int}")]
    [Authorize]
    public async Task<IActionResult> GetBookingReview(int bookingId)
    {
        var review = await _reviewService.GetBookingReviewAsync(bookingId);
        if (review == null)
            return NotFound(new { message = "No review found for this booking." });

        return Ok(review);
    }

    /// <summary>
    /// 8.5 Worker responds to a customer review on their completed booking
    /// </summary>
    [HttpPut("{id:int}/response")]
    [Authorize(Roles = "Worker")]
    public async Task<IActionResult> RespondToReview(int id, [FromBody] WorkerReviewResponseDto dto)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        try
        {
            var result = await _reviewService.RespondToReviewAsync(userId, id, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    /// <summary>
    /// 8.7 List completed bookings eligible for customer review
    /// </summary>
    [HttpGet("eligible-bookings")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> GetEligibleBookings()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var bookings = await _reviewService.GetCompletedBookingsEligibleForReviewAsync(userId);
        return Ok(bookings);
    }
}
