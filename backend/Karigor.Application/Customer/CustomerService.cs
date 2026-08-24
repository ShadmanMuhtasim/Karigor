using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Customer.DTOs;
using Karigor.Application.Worker.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Customer;

public class CustomerService : ICustomerService
{
    private readonly KarigorDbContext _db;

    public CustomerService(KarigorDbContext db)
    {
        _db = db;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: resolve CustomerProfile from JWT UserId, throw 404 if missing
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<CustomerProfile> GetCustomerProfileOrThrowAsync(string userId)
    {
        var profile = await _db.CustomerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Customer profile not found for the authenticated user.");

        return profile;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Profile
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<CustomerProfileDto> GetProfileAsync(string userId)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        return MapProfileToDto(profile, user?.Email ?? string.Empty);
    }

    public async Task<CustomerProfileDto> UpdateProfileAsync(string userId, UpdateCustomerProfileDto dto)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);

        profile.FullName        = dto.FullName;
        profile.Address         = dto.Address;
        profile.ProfileImageUrl = dto.ProfileImageUrl;

        await _db.SaveChangesAsync();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        return MapProfileToDto(profile, user?.Email ?? string.Empty);
    }

    private static CustomerProfileDto MapProfileToDto(CustomerProfile profile, string email) =>
        new()
        {
            Id              = profile.Id,
            UserId          = profile.UserId,
            Email           = email,
            FullName        = profile.FullName,
            Address         = profile.Address,
            ProfileImageUrl = profile.ProfileImageUrl
        };

    // ─────────────────────────────────────────────────────────────────────────
    // Service Requests
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<ServiceRequestDto> CreateServiceRequestAsync(string userId, CreateServiceRequestDto dto)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);

        var category = await _db.ServiceCategories.FindAsync(dto.CategoryId);
        if (category is null)
            throw new InvalidOperationException($"ServiceCategory with ID {dto.CategoryId} does not exist.");

        if (dto.PreferredDate < DateTime.UtcNow.AddMinutes(-30))
            throw new InvalidOperationException("Preferred date must be in the future.");

        var request = new ServiceRequest
        {
            CustomerId    = profile.Id,
            CategoryId    = dto.CategoryId,
            Description   = dto.Description,
            Address       = dto.Address,
            Latitude      = dto.Latitude,
            Longitude     = dto.Longitude,
            PreferredDate = dto.PreferredDate,
            Status        = "Open",
            PhotoUrls     = dto.PhotoUrls
        };

        _db.ServiceRequests.Add(request);
        await _db.SaveChangesAsync();

        return MapRequestToDto(request, profile.FullName, category);
    }

    public async Task<List<ServiceRequestDto>> GetServiceRequestsAsync(string userId, string? status = null)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);

        var query = _db.ServiceRequests
            .Include(r => r.Category)
            .Include(r => r.Customer)
            .Include(r => r.Quotations)
            .Where(r => r.CustomerId == profile.Id);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status);
        }

        var requests = await query
            .OrderByDescending(r => r.Id)
            .ToListAsync();

        return requests.Select(r => MapRequestToDto(r, profile.FullName, r.Category)).ToList();
    }

    public async Task<ServiceRequestDto> GetServiceRequestByIdAsync(string userId, int requestId)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);

        var request = await _db.ServiceRequests
            .Include(r => r.Category)
            .Include(r => r.Customer)
            .Include(r => r.Quotations)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.CustomerId == profile.Id);

        if (request is null)
            throw new KeyNotFoundException($"Service request with ID {requestId} not found.");

        return MapRequestToDto(request, profile.FullName, request.Category);
    }

    private static ServiceRequestDto MapRequestToDto(ServiceRequest request, string customerName, ServiceCategory category) =>
        new()
        {
            Id              = request.Id,
            CustomerId      = request.CustomerId,
            CustomerName    = customerName,
            CategoryId      = request.CategoryId,
            CategoryName    = category.Name,
            CategoryIconUrl = category.IconUrl,
            Description     = request.Description,
            Address         = request.Address,
            Latitude        = request.Latitude,
            Longitude       = request.Longitude,
            PreferredDate   = request.PreferredDate,
            Status          = request.Status,
            PhotoUrls       = request.PhotoUrls,
            QuotationsCount = request.Quotations.Count
        };

    // ─────────────────────────────────────────────────────────────────────────
    // Worker Discovery
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<WorkerSearchResultDto>> SearchWorkersAsync(WorkerSearchParamsDto query)
    {
        var dbQuery = _db.WorkerProfiles
            .Include(w => w.Categories)
            .Include(w => w.User)
            .AsQueryable();

        if (query.CategoryId.HasValue)
        {
            dbQuery = dbQuery.Where(w => w.Categories.Any(c => c.Id == query.CategoryId.Value));
        }

        if (query.MinRating.HasValue)
        {
            dbQuery = dbQuery.Where(w => w.AverageRating >= query.MinRating.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.SearchTerm))
        {
            var term = query.SearchTerm.Trim().ToLower();
            dbQuery = dbQuery.Where(w =>
                (w.Bio != null && w.Bio.ToLower().Contains(term)) ||
                (w.User.Email != null && w.User.Email.ToLower().Contains(term)) ||
                w.Categories.Any(c => c.Name.ToLower().Contains(term)));
        }

        var workers = await dbQuery.ToListAsync();

        var results = new List<WorkerSearchResultDto>();

        foreach (var worker in workers)
        {
            double? distance = null;
            if (query.Latitude.HasValue && query.Longitude.HasValue &&
                worker.Latitude.HasValue && worker.Longitude.HasValue)
            {
                distance = CalculateDistanceKm(
                    query.Latitude.Value,
                    query.Longitude.Value,
                    worker.Latitude.Value,
                    worker.Longitude.Value);

                if (query.RadiusKm.HasValue && distance > query.RadiusKm.Value)
                {
                    continue;
                }
            }

            results.Add(new WorkerSearchResultDto
            {
                Id                 = worker.Id,
                UserId             = worker.UserId,
                Email              = worker.User?.Email ?? string.Empty,
                Bio                = worker.Bio,
                HourlyRate         = worker.HourlyRate,
                Latitude           = worker.Latitude,
                Longitude          = worker.Longitude,
                ServiceRadiusKm    = worker.ServiceRadiusKm,
                VerificationStatus = worker.VerificationStatus,
                AverageRating      = worker.AverageRating,
                DistanceKm         = distance,
                Skills             = worker.Categories.Select(c => new SkillDto
                {
                    CategoryId   = c.Id,
                    CategoryName = c.Name,
                    IconUrl      = c.IconUrl
                }).ToList()
            });
        }

        // Sort by distance if location provided, else by rating
        if (query.Latitude.HasValue && query.Longitude.HasValue)
        {
            return results
                .OrderBy(r => r.DistanceKm ?? double.MaxValue)
                .ThenByDescending(r => r.AverageRating)
                .ToList();
        }

        return results
            .OrderByDescending(r => r.AverageRating)
            .ThenBy(r => r.HourlyRate)
            .ToList();
    }

    public async Task<WorkerPublicDetailDto> GetWorkerPublicProfileAsync(int workerId)
    {
        var worker = await _db.WorkerProfiles
            .Include(w => w.Categories)
            .Include(w => w.WorkerAvailabilities)
            .Include(w => w.User)
            .FirstOrDefaultAsync(w => w.Id == workerId);

        if (worker is null)
            throw new KeyNotFoundException($"Worker with ID {workerId} not found.");

        return new WorkerPublicDetailDto
        {
            Id                 = worker.Id,
            UserId             = worker.UserId,
            Email              = worker.User?.Email ?? string.Empty,
            Bio                = worker.Bio,
            HourlyRate         = worker.HourlyRate,
            Latitude           = worker.Latitude,
            Longitude          = worker.Longitude,
            ServiceRadiusKm    = worker.ServiceRadiusKm,
            VerificationStatus = worker.VerificationStatus,
            AverageRating      = worker.AverageRating,
            Skills             = worker.Categories.Select(c => new SkillDto
            {
                CategoryId   = c.Id,
                CategoryName = c.Name,
                IconUrl      = c.IconUrl
            }).ToList(),
            Availability       = worker.WorkerAvailabilities
                .OrderBy(a => a.DayOfWeek)
                .ThenBy(a => a.StartTime)
                .Select(a => new AvailabilitySlotDto
                {
                    Id        = a.Id,
                    DayOfWeek = a.DayOfWeek,
                    StartTime = a.StartTime.ToString("HH:mm"),
                    EndTime   = a.EndTime.ToString("HH:mm")
                }).ToList()
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dashboard Stats
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<CustomerDashboardStatsDto> GetDashboardStatsAsync(string userId)
    {
        var profile = await GetCustomerProfileOrThrowAsync(userId);

        var totalRequests = await _db.ServiceRequests
            .CountAsync(r => r.CustomerId == profile.Id);

        var activeRequests = await _db.ServiceRequests
            .CountAsync(r => r.CustomerId == profile.Id &&
                             (r.Status == "Open" || r.Status == "InProgress" || r.Status == "Pending"));

        var completedRequests = await _db.ServiceRequests
            .CountAsync(r => r.CustomerId == profile.Id && r.Status == "Completed");

        var totalBookings = await _db.Bookings
            .CountAsync(b => b.CustomerId == profile.Id);

        return new CustomerDashboardStatsDto
        {
            TotalRequests     = totalRequests,
            ActiveRequests    = activeRequests,
            CompletedRequests = completedRequests,
            TotalBookings     = totalBookings
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Distance Helper (Haversine formula in KM)
    // ─────────────────────────────────────────────────────────────────────────
    private static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = (lat2 - lat1) * (Math.PI / 180.0);
        var dLon = (lon2 - lon1) * (Math.PI / 180.0);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * (Math.PI / 180.0)) * Math.Cos(lat2 * (Math.PI / 180.0)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round(6371.0 * c, 2);
    }
}

