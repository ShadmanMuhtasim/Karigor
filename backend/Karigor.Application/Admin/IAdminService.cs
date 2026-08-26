using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Admin.DTOs;

namespace Karigor.Application.Admin;

public interface IAdminService
{
    // 9.9 Analytics & Stats
    Task<AdminStatsDto> GetPlatformStatsAsync();

    // 9.2 & 9.3 Worker Verification
    Task<List<PendingWorkerDto>> GetPendingWorkersAsync(string? status = null, string? search = null);
    Task<PendingWorkerDto> VerifyWorkerAsync(int workerId, VerifyWorkerDto dto);

    // 9.4 & 9.5 User Management
    Task<List<AdminUserDto>> GetUsersAsync(string? role = null, string? search = null, bool? isSuspended = null);
    Task<AdminUserDto> ToggleUserSuspensionAsync(string userId, UserSuspensionDto dto);

    // 9.6 Booking Monitoring
    Task<List<AdminBookingDto>> GetBookingsAsync(string? status = null, string? search = null);

    // 9.7 & 9.8 Review Moderation
    Task<List<AdminReviewDto>> GetReviewsAsync(string? search = null, int? minRating = null, int? maxRating = null);
    Task<AdminReviewDto> ModerateReviewAsync(int reviewId, ModerateReviewDto dto);
    Task DeleteReviewAsync(int reviewId);

    // 9.10 - 9.13 Service Category CRUD
    Task<List<AdminCategoryDto>> GetCategoriesAsync();
    Task<AdminCategoryDto> CreateCategoryAsync(CreateCategoryDto dto);
    Task<AdminCategoryDto> UpdateCategoryAsync(int id, UpdateCategoryDto dto);
    Task DeleteCategoryAsync(int id);
}
