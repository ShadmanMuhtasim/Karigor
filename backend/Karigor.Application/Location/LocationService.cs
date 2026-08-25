using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Location.DTOs;
using Karigor.Application.Worker.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Location;

public class LocationService : ILocationService
{
    private readonly KarigorDbContext _db;

    public LocationService(KarigorDbContext db)
    {
        _db = db;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6.1 Find nearby workers
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<NearbyWorkerDto>> GetNearbyWorkersAsync(NearbyWorkerParamsDto query)
    {
        var dbQuery = _db.WorkerProfiles
            .Include(w => w.Categories)
            .Include(w => w.User)
            .Where(w => w.Latitude.HasValue && w.Longitude.HasValue)
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
        var results = new List<NearbyWorkerDto>();

        foreach (var worker in workers)
        {
            var distance = CalculateDistanceKm(
                query.Latitude,
                query.Longitude,
                worker.Latitude!.Value,
                worker.Longitude!.Value);

            // If a custom search radius was specified, use that; otherwise use worker's service radius
            var maxAllowedDistance = query.RadiusKm ?? worker.ServiceRadiusKm;
            if (distance > maxAllowedDistance)
            {
                continue;
            }

            results.Add(new NearbyWorkerDto
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

        return results
            .OrderBy(r => r.DistanceKm)
            .ThenByDescending(r => r.AverageRating)
            .ToList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6.2 Worker update location
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<WorkerProfileDto> UpdateWorkerLocationAsync(string workerUserId, UpdateWorkerLocationDto dto)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .FirstOrDefaultAsync(p => p.UserId == workerUserId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        profile.Latitude = dto.Latitude;
        profile.Longitude = dto.Longitude;

        if (dto.ServiceRadiusKm.HasValue)
        {
            profile.ServiceRadiusKm = dto.ServiceRadiusKm.Value;
        }

        await _db.SaveChangesAsync();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == workerUserId);

        return new WorkerProfileDto
        {
            Id                 = profile.Id,
            Email              = user?.Email ?? string.Empty,
            Bio                = profile.Bio,
            HourlyRate         = profile.HourlyRate,
            Latitude           = profile.Latitude,
            Longitude          = profile.Longitude,
            ServiceRadiusKm    = profile.ServiceRadiusKm,
            VerificationStatus = profile.VerificationStatus,
            AverageRating      = profile.AverageRating,
            Skills             = profile.Categories.Select(c => new SkillDto
            {
                CategoryId   = c.Id,
                CategoryName = c.Name,
                IconUrl      = c.IconUrl
            }).ToList()
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6.3 Find nearby service requests for worker
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<NearbyRequestDto>> GetNearbyRequestsForWorkerAsync(string workerUserId, NearbyRequestParamsDto? query)
    {
        var worker = await _db.WorkerProfiles
            .Include(w => w.Categories)
            .FirstOrDefaultAsync(w => w.UserId == workerUserId);

        if (worker is null)
            throw new KeyNotFoundException("Worker profile not found.");

        double centerLat;
        double centerLng;

        if (query?.Latitude.HasValue == true && query?.Longitude.HasValue == true)
        {
            centerLat = query.Latitude.Value;
            centerLng = query.Longitude.Value;
        }
        else if (worker.Latitude.HasValue && worker.Longitude.HasValue)
        {
            centerLat = worker.Latitude.Value;
            centerLng = worker.Longitude.Value;
        }
        else
        {
            throw new InvalidOperationException(
                "Worker location is not set. Please provide coordinates in the request or set your profile location.");
        }

        var effectiveRadius = query?.RadiusKm ?? worker.ServiceRadiusKm;
        if (effectiveRadius <= 0)
        {
            effectiveRadius = 15.0; // fallback default 15 km
        }

        var workerCategoryIds = worker.Categories.Select(c => c.Id).ToHashSet();

        var dbQuery = _db.ServiceRequests
            .Include(r => r.Category)
            .Include(r => r.Customer)
            .Include(r => r.Quotations)
            .Where(r => r.Status == "Open" && r.Latitude.HasValue && r.Longitude.HasValue)
            .AsQueryable();

        if (query?.CategoryId.HasValue == true)
        {
            dbQuery = dbQuery.Where(r => r.CategoryId == query.CategoryId.Value);
        }
        else if (workerCategoryIds.Count > 0)
        {
            dbQuery = dbQuery.Where(r => workerCategoryIds.Contains(r.CategoryId));
        }

        var requests = await dbQuery.ToListAsync();
        var results = new List<NearbyRequestDto>();

        foreach (var req in requests)
        {
            var distance = CalculateDistanceKm(
                centerLat,
                centerLng,
                req.Latitude!.Value,
                req.Longitude!.Value);

            if (distance > effectiveRadius)
            {
                continue;
            }

            results.Add(new NearbyRequestDto
            {
                Id              = req.Id,
                CustomerId      = req.CustomerId,
                CustomerName    = req.Customer?.FullName ?? $"Customer #{req.CustomerId}",
                CategoryId      = req.CategoryId,
                CategoryName    = req.Category?.Name ?? string.Empty,
                CategoryIconUrl = req.Category?.IconUrl,
                Description     = req.Description,
                Address         = req.Address,
                Latitude        = req.Latitude,
                Longitude       = req.Longitude,
                PreferredDate   = req.PreferredDate,
                Status          = req.Status,
                PhotoUrls       = req.PhotoUrls,
                DistanceKm      = distance,
                QuotationsCount = req.Quotations.Count
            });
        }

        return results
            .OrderBy(r => r.DistanceKm)
            .ThenBy(r => r.PreferredDate)
            .ToList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Haversine distance in Kilometers
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
