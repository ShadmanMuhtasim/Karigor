using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Application.Reviews.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Reviews;

public class ReviewService : IReviewService
{
    private readonly KarigorDbContext _db;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotifier _realtimeNotifier;

    public ReviewService(
        KarigorDbContext db,
        INotificationService notificationService,
        IRealtimeNotifier realtimeNotifier)
    {
        _db = db;
        _notificationService = notificationService;
        _realtimeNotifier = realtimeNotifier;
    }

    public async Task<ReviewDto> CreateReviewAsync(string customerUserId, CreateReviewDto dto)
    {
        var customer = await _db.CustomerProfiles
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.UserId == customerUserId);

        if (customer == null)
            throw new KeyNotFoundException("Customer profile not found.");

        var booking = await _db.Bookings
            .Include(b => b.Worker)
            .ThenInclude(w => w.User)
            .Include(b => b.ServiceRequest)
            .ThenInclude(sr => sr.Category)
            .Include(b => b.Review)
            .FirstOrDefaultAsync(b => b.Id == dto.BookingId);

        if (booking == null)
            throw new KeyNotFoundException($"Booking #{dto.BookingId} not found.");

        if (booking.CustomerId != customer.Id)
            throw new UnauthorizedAccessException("You can only review your own bookings.");

        if (!string.Equals(booking.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Reviews can only be submitted after a service booking has been marked as Completed.");

        if (booking.Review != null || await _db.Reviews.AnyAsync(r => r.BookingId == dto.BookingId))
            throw new InvalidOperationException("A review has already been submitted for this booking.");

        var review = new Review
        {
            BookingId = dto.BookingId,
            Rating = dto.Rating,
            Comment = dto.Comment?.Trim(),
            WorkerResponse = null
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();

        // Recalculate WorkerProfile.AverageRating
        var worker = await _db.WorkerProfiles
            .Include(w => w.Bookings)
            .ThenInclude(b => b.Review)
            .FirstOrDefaultAsync(w => w.Id == booking.WorkerId);

        if (worker != null)
        {
            var ratings = worker.Bookings
                .Where(b => b.Review != null)
                .Select(b => b.Review!.Rating)
                .ToList();

            worker.AverageRating = ratings.Count > 0 ? Math.Round(ratings.Average(), 2) : 0;
            await _db.SaveChangesAsync();
        }

        var resultDto = new ReviewDto
        {
            Id = review.Id,
            BookingId = review.BookingId,
            WorkerId = booking.WorkerId,
            WorkerName = booking.Worker.User?.Email ?? $"Worker #{booking.WorkerId}",
            CustomerId = customer.Id,
            CustomerName = customer.FullName ?? customer.User?.Email ?? "Customer",
            CustomerProfileImageUrl = customer.ProfileImageUrl,
            CategoryName = booking.ServiceRequest?.Category?.Name ?? "Service",
            Rating = review.Rating,
            Comment = review.Comment,
            WorkerResponse = review.WorkerResponse,
            BookingDate = booking.ScheduledDate
        };

        // Trigger in-app notification for the worker
        try
        {
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = booking.Worker.UserId,
                Type = "ReviewCreated",
                Message = $"⭐ {resultDto.CustomerName} left a {dto.Rating}-star review for your completed {resultDto.CategoryName} job.",
                RelatedEntityId = review.Id
            });

            // Dispatches live WebSocket event
            await _realtimeNotifier.BroadcastAsync("ReviewCreated", resultDto);
        }
        catch
        {
            // Notification dispatch should not fail the review creation transaction
        }

        return resultDto;
    }

    public async Task<WorkerReviewsSummaryDto> GetWorkerReviewsAsync(int workerId)
    {
        var worker = await _db.WorkerProfiles
            .Include(w => w.User)
            .Include(w => w.Bookings)
                .ThenInclude(b => b.Review)
            .Include(w => w.Bookings)
                .ThenInclude(b => b.Customer)
                    .ThenInclude(c => c.User)
            .Include(w => w.Bookings)
                .ThenInclude(b => b.ServiceRequest)
                    .ThenInclude(sr => sr.Category)
            .FirstOrDefaultAsync(w => w.Id == workerId);

        if (worker == null)
            throw new KeyNotFoundException($"Worker #{workerId} not found.");

        var reviewsQuery = worker.Bookings
            .Where(b => b.Review != null)
            .Select(b => new ReviewDto
            {
                Id = b.Review!.Id,
                BookingId = b.Id,
                WorkerId = worker.Id,
                WorkerName = worker.User?.Email ?? $"Worker #{worker.Id}",
                CustomerId = b.CustomerId,
                CustomerName = b.Customer.FullName ?? b.Customer.User?.Email ?? "Customer",
                CustomerProfileImageUrl = b.Customer.ProfileImageUrl,
                CategoryName = b.ServiceRequest.Category.Name,
                Rating = b.Review.Rating,
                Comment = b.Review.Comment,
                WorkerResponse = b.Review.WorkerResponse,
                BookingDate = b.ScheduledDate
            })
            .OrderByDescending(r => r.Id)
            .ToList();

        var distribution = new Dictionary<int, int>
        {
            { 5, 0 },
            { 4, 0 },
            { 3, 0 },
            { 2, 0 },
            { 1, 0 }
        };

        foreach (var r in reviewsQuery)
        {
            if (distribution.ContainsKey(r.Rating))
                distribution[r.Rating]++;
        }

        var total = reviewsQuery.Count;
        var avg = total > 0 ? Math.Round(reviewsQuery.Average(r => r.Rating), 2) : 0;

        return new WorkerReviewsSummaryDto
        {
            WorkerId = workerId,
            AverageRating = avg,
            TotalReviews = total,
            RatingDistribution = distribution,
            Reviews = reviewsQuery
        };
    }

    public async Task<ReviewDto?> GetBookingReviewAsync(int bookingId)
    {
        var review = await _db.Reviews
            .Include(r => r.Booking)
                .ThenInclude(b => b.Customer)
                    .ThenInclude(c => c.User)
            .Include(r => r.Booking)
                .ThenInclude(b => b.Worker)
                    .ThenInclude(w => w.User)
            .Include(r => r.Booking)
                .ThenInclude(b => b.ServiceRequest)
                    .ThenInclude(sr => sr.Category)
            .FirstOrDefaultAsync(r => r.BookingId == bookingId);

        if (review == null) return null;

        return new ReviewDto
        {
            Id = review.Id,
            BookingId = review.BookingId,
            WorkerId = review.Booking.WorkerId,
            WorkerName = review.Booking.Worker.User?.Email ?? $"Worker #{review.Booking.WorkerId}",
            CustomerId = review.Booking.CustomerId,
            CustomerName = review.Booking.Customer.FullName ?? review.Booking.Customer.User?.Email ?? "Customer",
            CustomerProfileImageUrl = review.Booking.Customer.ProfileImageUrl,
            CategoryName = review.Booking.ServiceRequest.Category.Name,
            Rating = review.Rating,
            Comment = review.Comment,
            WorkerResponse = review.WorkerResponse,
            BookingDate = review.Booking.ScheduledDate
        };
    }

    public async Task<ReviewDto> RespondToReviewAsync(string workerUserId, int reviewId, WorkerReviewResponseDto dto)
    {
        var worker = await _db.WorkerProfiles
            .Include(w => w.User)
            .FirstOrDefaultAsync(w => w.UserId == workerUserId);

        if (worker == null)
            throw new KeyNotFoundException("Worker profile not found.");

        var review = await _db.Reviews
            .Include(r => r.Booking)
                .ThenInclude(b => b.Customer)
                    .ThenInclude(c => c.User)
            .Include(r => r.Booking)
                .ThenInclude(b => b.ServiceRequest)
                    .ThenInclude(sr => sr.Category)
            .FirstOrDefaultAsync(r => r.Id == reviewId);

        if (review == null)
            throw new KeyNotFoundException($"Review #{reviewId} not found.");

        if (review.Booking.WorkerId != worker.Id)
            throw new UnauthorizedAccessException("You can only respond to reviews on your own bookings.");

        review.WorkerResponse = dto.Response.Trim();
        await _db.SaveChangesAsync();

        var resultDto = new ReviewDto
        {
            Id = review.Id,
            BookingId = review.BookingId,
            WorkerId = worker.Id,
            WorkerName = worker.User?.Email ?? $"Worker #{worker.Id}",
            CustomerId = review.Booking.CustomerId,
            CustomerName = review.Booking.Customer.FullName ?? review.Booking.Customer.User?.Email ?? "Customer",
            CustomerProfileImageUrl = review.Booking.Customer.ProfileImageUrl,
            CategoryName = review.Booking.ServiceRequest.Category.Name,
            Rating = review.Rating,
            Comment = review.Comment,
            WorkerResponse = review.WorkerResponse,
            BookingDate = review.Booking.ScheduledDate
        };

        // Notify customer
        try
        {
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = review.Booking.Customer.UserId,
                Type = "ReviewResponse",
                Message = $"💬 {resultDto.WorkerName} replied to your review on booking #{review.BookingId}.",
                RelatedEntityId = review.Id
            });

            await _realtimeNotifier.BroadcastAsync("ReviewUpdated", resultDto);
        }
        catch { }

        return resultDto;
    }

    public async Task<List<BookingDto>> GetCompletedBookingsEligibleForReviewAsync(string customerUserId)
    {
        var customer = await _db.CustomerProfiles
            .FirstOrDefaultAsync(c => c.UserId == customerUserId);

        if (customer == null)
            throw new KeyNotFoundException("Customer profile not found.");

        var bookings = await _db.Bookings
            .Include(b => b.Worker)
                .ThenInclude(w => w.User)
            .Include(b => b.ServiceRequest)
                .ThenInclude(sr => sr.Category)
            .Include(b => b.Review)
            .Where(b => b.CustomerId == customer.Id && b.Status == "Completed" && b.Review == null)
            .OrderByDescending(b => b.ScheduledDate)
            .Select(b => new BookingDto
            {
                Id = b.Id,
                ServiceRequestId = b.ServiceRequestId,
                CategoryName = b.ServiceRequest.Category.Name,
                WorkerId = b.WorkerId,
                WorkerName = b.Worker.User.Email,
                CustomerId = b.CustomerId,
                CustomerName = customer.FullName ?? "Customer",
                AgreedPrice = b.AgreedPrice,
                ScheduledDate = b.ScheduledDate,
                Status = b.Status,
                Address = b.ServiceRequest.Address,
                Description = b.ServiceRequest.Description
            })
            .ToListAsync();

        return bookings;
    }
}
