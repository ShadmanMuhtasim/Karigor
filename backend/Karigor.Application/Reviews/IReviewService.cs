using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Reviews.DTOs;

namespace Karigor.Application.Reviews;

public interface IReviewService
{
    Task<ReviewDto> CreateReviewAsync(string customerUserId, CreateReviewDto dto);
    Task<WorkerReviewsSummaryDto> GetWorkerReviewsAsync(int workerId);
    Task<ReviewDto?> GetBookingReviewAsync(int bookingId);
    Task<ReviewDto> RespondToReviewAsync(string workerUserId, int reviewId, WorkerReviewResponseDto dto);
    Task<List<BookingDto>> GetCompletedBookingsEligibleForReviewAsync(string customerUserId);
}
