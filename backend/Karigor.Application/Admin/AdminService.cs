using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Admin.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Admin;

public class AdminService : IAdminService
{
    private readonly KarigorDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotifier _realtimeNotifier;

    public AdminService(
        KarigorDbContext db,
        UserManager<ApplicationUser> userManager,
        INotificationService notificationService,
        IRealtimeNotifier realtimeNotifier)
    {
        _db = db;
        _userManager = userManager;
        _notificationService = notificationService;
        _realtimeNotifier = realtimeNotifier;
    }

    // -------------------------------------------------------------------------
    // 9.9 Analytics & Platform Stats
    // -------------------------------------------------------------------------
    public async Task<AdminStatsDto> GetPlatformStatsAsync()
    {
        var totalUsers = await _userManager.Users.CountAsync();
        var totalCustomers = await _db.CustomerProfiles.CountAsync();
        var totalWorkers = await _db.WorkerProfiles.CountAsync();
        var verifiedWorkers = await _db.WorkerProfiles.CountAsync(w => w.VerificationStatus == "Verified");
        var pendingVerifications = await _db.WorkerProfiles.CountAsync(w => w.VerificationStatus == "Pending");
        
        var totalRequests = await _db.ServiceRequests.CountAsync();
        var openRequests = await _db.ServiceRequests.CountAsync(r => r.Status == "Open");

        var totalBookings = await _db.Bookings.CountAsync();
        var completedBookings = await _db.Bookings.CountAsync(b => b.Status == "Completed");
        var inProgressBookings = await _db.Bookings.CountAsync(b => b.Status == "InProgress");
        var cancelledBookings = await _db.Bookings.CountAsync(b => b.Status == "Cancelled");

        var totalVolume = await _db.Bookings
            .Where(b => b.Status == "Completed")
            .SumAsync(b => (decimal?)b.AgreedPrice) ?? 0m;

        var totalReviews = await _db.Reviews.CountAsync();
        var avgRating = totalReviews > 0
            ? Math.Round(await _db.Reviews.AverageAsync(r => r.Rating), 2)
            : 0.0;

        var totalCategories = await _db.ServiceCategories.CountAsync();

        return new AdminStatsDto
        {
            TotalUsers = totalUsers,
            TotalCustomers = totalCustomers,
            TotalWorkers = totalWorkers,
            VerifiedWorkers = verifiedWorkers,
            PendingVerifications = pendingVerifications,
            TotalServiceRequests = totalRequests,
            OpenServiceRequests = openRequests,
            TotalBookings = totalBookings,
            CompletedBookings = completedBookings,
            InProgressBookings = inProgressBookings,
            CancelledBookings = cancelledBookings,
            TotalPlatformVolume = totalVolume,
            AveragePlatformRating = avgRating,
            TotalReviews = totalReviews,
            TotalCategories = totalCategories
        };
    }

    // -------------------------------------------------------------------------
    // 9.2 & 9.3 Worker Verification
    // -------------------------------------------------------------------------
    public async Task<List<PendingWorkerDto>> GetPendingWorkersAsync(string? status = null, string? search = null)
    {
        var query = _db.WorkerProfiles
            .Include(w => w.User)
            .Include(w => w.Categories)
            .Include(w => w.WorkerDocuments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(w => w.VerificationStatus == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(w => (w.User.Email != null && w.User.Email.ToLower().Contains(term)) ||
                                     (w.Bio != null && w.Bio.ToLower().Contains(term)));
        }

        var workers = await query
            .OrderByDescending(w => w.VerificationStatus == "Pending")
            .ThenByDescending(w => w.Id)
            .ToListAsync();

        return workers.Select(w => new PendingWorkerDto
        {
            WorkerId = w.Id,
            UserId = w.UserId,
            Email = w.User?.Email ?? $"Worker #{w.Id}",
            FullName = w.User?.Email?.Split('@')[0],
            Bio = w.Bio,
            HourlyRate = w.HourlyRate,
            VerificationStatus = w.VerificationStatus,
            AverageRating = w.AverageRating,
            ServiceRadiusKm = w.ServiceRadiusKm,
            Skills = w.Categories.Select(c => c.Name).ToList(),
            Documents = w.WorkerDocuments.Select(d => new WorkerVerificationDocumentDto
            {
                Id = d.Id,
                DocumentType = d.DocumentType,
                FileUrl = d.FileUrl,
                Status = d.Status
            }).ToList()
        }).ToList();
    }

    public async Task<PendingWorkerDto> VerifyWorkerAsync(int workerId, VerifyWorkerDto dto)
    {
        var worker = await _db.WorkerProfiles
            .Include(w => w.User)
            .Include(w => w.Categories)
            .Include(w => w.WorkerDocuments)
            .FirstOrDefaultAsync(w => w.Id == workerId);

        if (worker == null)
            throw new KeyNotFoundException($"Worker #{workerId} not found.");

        var normalizedStatus = string.Equals(dto.Status, "Rejected", StringComparison.OrdinalIgnoreCase) ? "Rejected" : "Verified";
        worker.VerificationStatus = normalizedStatus;

        foreach (var doc in worker.WorkerDocuments)
        {
            doc.Status = normalizedStatus;
        }

        await _db.SaveChangesAsync();

        var resultDto = new PendingWorkerDto
        {
            WorkerId = worker.Id,
            UserId = worker.UserId,
            Email = worker.User?.Email ?? $"Worker #{worker.Id}",
            FullName = worker.User?.Email?.Split('@')[0],
            Bio = worker.Bio,
            HourlyRate = worker.HourlyRate,
            VerificationStatus = worker.VerificationStatus,
            AverageRating = worker.AverageRating,
            ServiceRadiusKm = worker.ServiceRadiusKm,
            Skills = worker.Categories.Select(c => c.Name).ToList(),
            Documents = worker.WorkerDocuments.Select(d => new WorkerVerificationDocumentDto
            {
                Id = d.Id,
                DocumentType = d.DocumentType,
                FileUrl = d.FileUrl,
                Status = d.Status
            }).ToList()
        };

        // Send in-app notification & broadcast
        try
        {
            var message = normalizedStatus == "Verified"
                ? "🎉 Congratulations! Your Karigor artisan verification has been APPROVED. Your profile now carries the verified badge."
                : $"⚠️ Your verification submission was reviewed and marked as Rejected. {(string.IsNullOrWhiteSpace(dto.Note) ? "" : $"Note: {dto.Note}")}";

            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = worker.UserId,
                Type = normalizedStatus == "Verified" ? "WorkerVerified" : "WorkerRejected",
                Message = message,
                RelatedEntityId = worker.Id
            });

            await _realtimeNotifier.BroadcastAsync("WorkerVerificationUpdated", resultDto);
        }
        catch { }

        return resultDto;
    }

    // -------------------------------------------------------------------------
    // 9.4 & 9.5 User Management & Suspension
    // -------------------------------------------------------------------------
    public async Task<List<AdminUserDto>> GetUsersAsync(string? role = null, string? search = null, bool? isSuspended = null)
    {
        var users = await _userManager.Users
            .Include(u => u.CustomerProfile)
            .Include(u => u.WorkerProfile)
            .ToListAsync();

        var result = new List<AdminUserDto>();

        foreach (var user in users)
        {
            var userRoles = await _userManager.GetRolesAsync(user);
            var userRole = userRoles.FirstOrDefault() ?? "Customer";

            if (!string.IsNullOrWhiteSpace(role) && !string.Equals(role, "All", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(userRole, role, StringComparison.OrdinalIgnoreCase))
                    continue;
            }

            var suspended = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow;
            if (isSuspended.HasValue && suspended != isSuspended.Value)
                continue;

            var fullName = user.CustomerProfile?.FullName ?? user.Email?.Split('@')[0];

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                var emailMatch = user.Email != null && user.Email.ToLower().Contains(term);
                var nameMatch = fullName != null && fullName.ToLower().Contains(term);
                if (!emailMatch && !nameMatch)
                    continue;
            }

            result.Add(new AdminUserDto
            {
                Id = user.Id,
                Email = user.Email ?? "Unknown",
                Role = userRole,
                FullName = fullName,
                IsSuspended = suspended,
                LockoutEnd = user.LockoutEnd,
                WorkerProfileId = user.WorkerProfile?.Id,
                CustomerProfileId = user.CustomerProfile?.Id
            });
        }

        return result.OrderBy(u => u.Email).ToList();
    }

    public async Task<AdminUserDto> ToggleUserSuspensionAsync(string userId, UserSuspensionDto dto)
    {
        var user = await _userManager.Users
            .Include(u => u.CustomerProfile)
            .Include(u => u.WorkerProfile)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new KeyNotFoundException($"User #{userId} not found.");

        user.LockoutEnabled = true;

        if (dto.Suspend)
        {
            user.LockoutEnd = DateTimeOffset.UtcNow.AddYears(100);

            // Revoke all active refresh tokens immediately
            var tokens = await _db.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ToListAsync();

            foreach (var t in tokens)
            {
                t.RevokedAt = DateTime.UtcNow;
            }
        }
        else
        {
            user.LockoutEnd = null;
        }

        await _userManager.UpdateAsync(user);
        await _db.SaveChangesAsync();

        var roles = await _userManager.GetRolesAsync(user);
        var userRole = roles.FirstOrDefault() ?? "Customer";
        var isSuspended = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow;

        return new AdminUserDto
        {
            Id = user.Id,
            Email = user.Email ?? "Unknown",
            Role = userRole,
            FullName = user.CustomerProfile?.FullName ?? user.Email?.Split('@')[0],
            IsSuspended = isSuspended,
            LockoutEnd = user.LockoutEnd,
            WorkerProfileId = user.WorkerProfile?.Id,
            CustomerProfileId = user.CustomerProfile?.Id
        };
    }

    // -------------------------------------------------------------------------
    // 9.6 Booking Monitoring
    // -------------------------------------------------------------------------
    public async Task<List<AdminBookingDto>> GetBookingsAsync(string? status = null, string? search = null)
    {
        var query = _db.Bookings
            .Include(b => b.Customer).ThenInclude(c => c.User)
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .Include(b => b.Review)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(b => b.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(b => (b.Customer.FullName != null && b.Customer.FullName.ToLower().Contains(term)) ||
                                     (b.Customer.User.Email != null && b.Customer.User.Email.ToLower().Contains(term)) ||
                                     (b.Worker.User.Email != null && b.Worker.User.Email.ToLower().Contains(term)) ||
                                     (b.ServiceRequest.Category.Name.ToLower().Contains(term)));
        }

        var bookings = await query
            .OrderByDescending(b => b.ScheduledDate)
            .ToListAsync();

        return bookings.Select(b => new AdminBookingDto
        {
            Id = b.Id,
            ServiceRequestId = b.ServiceRequestId,
            CategoryName = b.ServiceRequest?.Category?.Name ?? "Service",
            CustomerId = b.CustomerId,
            CustomerName = b.Customer?.FullName ?? b.Customer?.User?.Email ?? "Customer",
            CustomerEmail = b.Customer?.User?.Email ?? string.Empty,
            WorkerId = b.WorkerId,
            WorkerName = b.Worker?.User?.Email?.Split('@')[0] ?? $"Worker #{b.WorkerId}",
            WorkerEmail = b.Worker?.User?.Email ?? string.Empty,
            AgreedPrice = b.AgreedPrice,
            ScheduledDate = b.ScheduledDate,
            Status = b.Status,
            Address = b.ServiceRequest?.Address,
            HasReview = b.Review != null,
            ReviewRating = b.Review?.Rating
        }).ToList();
    }

    // -------------------------------------------------------------------------
    // 9.7 & 9.8 Review Moderation
    // -------------------------------------------------------------------------
    public async Task<List<AdminReviewDto>> GetReviewsAsync(string? search = null, int? minRating = null, int? maxRating = null)
    {
        var query = _db.Reviews
            .Include(r => r.Booking).ThenInclude(b => b.Customer).ThenInclude(c => c.User)
            .Include(r => r.Booking).ThenInclude(b => b.Worker).ThenInclude(w => w.User)
            .Include(r => r.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .AsQueryable();

        if (minRating.HasValue)
            query = query.Where(r => r.Rating >= minRating.Value);

        if (maxRating.HasValue)
            query = query.Where(r => r.Rating <= maxRating.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(r => (r.Comment != null && r.Comment.ToLower().Contains(term)) ||
                                     (r.WorkerResponse != null && r.WorkerResponse.ToLower().Contains(term)) ||
                                     (r.Booking.Customer.FullName != null && r.Booking.Customer.FullName.ToLower().Contains(term)) ||
                                     (r.Booking.Worker.User.Email != null && r.Booking.Worker.User.Email.ToLower().Contains(term)));
        }

        var reviews = await query
            .OrderByDescending(r => r.Id)
            .ToListAsync();

        return reviews.Select(r => new AdminReviewDto
        {
            Id = r.Id,
            BookingId = r.BookingId,
            CategoryName = r.Booking?.ServiceRequest?.Category?.Name ?? "Service",
            WorkerId = r.Booking?.WorkerId ?? 0,
            WorkerName = r.Booking?.Worker?.User?.Email ?? $"Worker #{r.Booking?.WorkerId}",
            CustomerId = r.Booking?.CustomerId ?? 0,
            CustomerName = r.Booking?.Customer?.FullName ?? r.Booking?.Customer?.User?.Email ?? "Customer",
            Rating = r.Rating,
            Comment = r.Comment,
            WorkerResponse = r.WorkerResponse,
            BookingDate = r.Booking?.ScheduledDate ?? DateTime.UtcNow
        }).ToList();
    }

    public async Task<AdminReviewDto> ModerateReviewAsync(int reviewId, ModerateReviewDto dto)
    {
        var review = await _db.Reviews
            .Include(r => r.Booking).ThenInclude(b => b.Customer).ThenInclude(c => c.User)
            .Include(r => r.Booking).ThenInclude(b => b.Worker).ThenInclude(w => w.User)
            .Include(r => r.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .FirstOrDefaultAsync(r => r.Id == reviewId);

        if (review == null)
            throw new KeyNotFoundException($"Review #{reviewId} not found.");

        if (dto.Comment != null)
            review.Comment = dto.Comment.Trim();

        if (dto.WorkerResponse != null)
            review.WorkerResponse = dto.WorkerResponse.Trim();

        await _db.SaveChangesAsync();

        return new AdminReviewDto
        {
            Id = review.Id,
            BookingId = review.BookingId,
            CategoryName = review.Booking?.ServiceRequest?.Category?.Name ?? "Service",
            WorkerId = review.Booking?.WorkerId ?? 0,
            WorkerName = review.Booking?.Worker?.User?.Email ?? $"Worker #{review.Booking?.WorkerId}",
            CustomerId = review.Booking?.CustomerId ?? 0,
            CustomerName = review.Booking?.Customer?.FullName ?? review.Booking?.Customer?.User?.Email ?? "Customer",
            Rating = review.Rating,
            Comment = review.Comment,
            WorkerResponse = review.WorkerResponse,
            BookingDate = review.Booking?.ScheduledDate ?? DateTime.UtcNow
        };
    }

    public async Task DeleteReviewAsync(int reviewId)
    {
        var review = await _db.Reviews
            .Include(r => r.Booking)
            .FirstOrDefaultAsync(r => r.Id == reviewId);

        if (review == null)
            throw new KeyNotFoundException($"Review #{reviewId} not found.");

        var workerId = review.Booking.WorkerId;
        _db.Reviews.Remove(review);
        await _db.SaveChangesAsync();

        // Recalculate worker average rating
        var worker = await _db.WorkerProfiles
            .Include(w => w.Bookings)
            .ThenInclude(b => b.Review)
            .FirstOrDefaultAsync(w => w.Id == workerId);

        if (worker != null)
        {
            var ratings = worker.Bookings
                .Where(b => b.Review != null)
                .Select(b => b.Review!.Rating)
                .ToList();

            worker.AverageRating = ratings.Count > 0 ? Math.Round(ratings.Average(), 2) : 0.0;
            await _db.SaveChangesAsync();
        }
    }

    // -------------------------------------------------------------------------
    // 9.10 - 9.13 Service Category CRUD
    // -------------------------------------------------------------------------
    public async Task<List<AdminCategoryDto>> GetCategoriesAsync()
    {
        var categories = await _db.ServiceCategories
            .Include(c => c.Workers)
            .Include(c => c.ServiceRequests)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return categories.Select(c => new AdminCategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            IconUrl = c.IconUrl,
            WorkerCount = c.Workers.Count,
            RequestCount = c.ServiceRequests.Count
        }).ToList();
    }

    public async Task<AdminCategoryDto> CreateCategoryAsync(CreateCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ArgumentException("Category name cannot be empty.");

        var exists = await _db.ServiceCategories.AnyAsync(c => c.Name.ToLower() == dto.Name.Trim().ToLower());
        if (exists)
            throw new InvalidOperationException($"Category '{dto.Name}' already exists.");

        var category = new ServiceCategory
        {
            Name = dto.Name.Trim(),
            IconUrl = dto.IconUrl?.Trim()
        };

        _db.ServiceCategories.Add(category);
        await _db.SaveChangesAsync();

        return new AdminCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            IconUrl = category.IconUrl,
            WorkerCount = 0,
            RequestCount = 0
        };
    }

    public async Task<AdminCategoryDto> UpdateCategoryAsync(int id, UpdateCategoryDto dto)
    {
        var category = await _db.ServiceCategories
            .Include(c => c.Workers)
            .Include(c => c.ServiceRequests)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new KeyNotFoundException($"Category #{id} not found.");

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ArgumentException("Category name cannot be empty.");

        var duplicate = await _db.ServiceCategories
            .AnyAsync(c => c.Id != id && c.Name.ToLower() == dto.Name.Trim().ToLower());

        if (duplicate)
            throw new InvalidOperationException($"Category '{dto.Name}' already exists.");

        category.Name = dto.Name.Trim();
        category.IconUrl = dto.IconUrl?.Trim();

        await _db.SaveChangesAsync();

        return new AdminCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            IconUrl = category.IconUrl,
            WorkerCount = category.Workers.Count,
            RequestCount = category.ServiceRequests.Count
        };
    }

    public async Task DeleteCategoryAsync(int id)
    {
        var category = await _db.ServiceCategories
            .Include(c => c.ServiceRequests)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            throw new KeyNotFoundException($"Category #{id} not found.");

        if (category.ServiceRequests.Any())
            throw new InvalidOperationException($"Cannot delete category '{category.Name}' because it has {category.ServiceRequests.Count} active service request(s) associated with it.");

        _db.ServiceCategories.Remove(category);
        await _db.SaveChangesAsync();
    }
}
