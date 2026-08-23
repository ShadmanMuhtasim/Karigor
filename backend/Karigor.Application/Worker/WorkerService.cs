using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Worker.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;
using Karigor.Abstractions.Worker;
using Microsoft.Extensions.Configuration;

namespace Karigor.Application.Worker;

public class WorkerService : IWorkerService
{
    private readonly KarigorDbContext _db;
    private readonly IUploadPathProvider _pathProvider;

    // Allowed document extensions (lower-case, without dot).
    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { "pdf", "jpg", "jpeg", "png" };

    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    public WorkerService(KarigorDbContext db, IUploadPathProvider pathProvider)
    {
        _db = db;
        _pathProvider = pathProvider;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: resolve WorkerProfile.Id from JWT UserId, throw 404 if missing
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<WorkerProfile> GetWorkerProfileOrThrowAsync(string userId)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .Include(p => p.WorkerAvailabilities)
            .Include(p => p.WorkerDocuments)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found for the authenticated user.");

        return profile;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Profile
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<WorkerProfileDto> GetProfileAsync(string userId)
    {
        var profile = await GetWorkerProfileOrThrowAsync(userId);

        // Fetch the user's email from AspNetUsers
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);

        return MapProfileToDto(profile, user?.Email ?? string.Empty);
    }

    public async Task<WorkerProfileDto> UpdateProfileAsync(string userId, UpdateWorkerProfileDto dto)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found for the authenticated user.");

        // Apply only editable fields — Id, UserId, VerificationStatus, AverageRating are untouched
        profile.Bio             = dto.Bio;
        profile.HourlyRate      = dto.HourlyRate;
        profile.Latitude        = dto.Latitude;
        profile.Longitude       = dto.Longitude;
        profile.ServiceRadiusKm = dto.ServiceRadiusKm;

        await _db.SaveChangesAsync();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        return MapProfileToDto(profile, user?.Email ?? string.Empty);
    }

    private static WorkerProfileDto MapProfileToDto(WorkerProfile profile, string email) =>
        new()
        {
            Id                 = profile.Id,
            Email              = email,
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

    // ─────────────────────────────────────────────────────────────────────────
    // Skills
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<SkillDto>> GetSkillsAsync(string userId)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        return profile.Categories.Select(c => new SkillDto
        {
            CategoryId   = c.Id,
            CategoryName = c.Name,
            IconUrl      = c.IconUrl
        }).ToList();
    }

    public async Task<List<SkillDto>> AddSkillsAsync(string userId, AddSkillsDto dto)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        // De-duplicate incoming IDs
        var requestedIds = dto.CategoryIds.Distinct().ToList();

        // Verify all requested categories exist
        var existingCategories = await _db.ServiceCategories
            .Where(c => requestedIds.Contains(c.Id))
            .ToListAsync();

        if (existingCategories.Count != requestedIds.Count)
        {
            var missing = requestedIds.Except(existingCategories.Select(c => c.Id));
            throw new InvalidOperationException(
                $"The following category IDs do not exist: {string.Join(", ", missing)}");
        }

        // Add only categories not already assigned (prevent duplicates)
        var alreadyAssigned = profile.Categories.Select(c => c.Id).ToHashSet();
        var toAdd = existingCategories.Where(c => !alreadyAssigned.Contains(c.Id)).ToList();

        foreach (var category in toAdd)
            profile.Categories.Add(category);

        await _db.SaveChangesAsync();

        return profile.Categories.Select(c => new SkillDto
        {
            CategoryId   = c.Id,
            CategoryName = c.Name,
            IconUrl      = c.IconUrl
        }).ToList();
    }

    public async Task RemoveSkillAsync(string userId, int categoryId)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        var category = profile.Categories.FirstOrDefault(c => c.Id == categoryId);
        if (category is null)
            throw new KeyNotFoundException($"Skill with category ID {categoryId} not found on this worker's profile.");

        // Removes only the junction row — the ServiceCategory row itself is untouched
        profile.Categories.Remove(category);
        await _db.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Availability
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<AvailabilitySlotDto>> GetAvailabilityAsync(string userId)
    {
        var profile = await _db.WorkerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        var slots = await _db.WorkerAvailabilities
            .Where(a => a.WorkerId == profile.Id)
            .OrderBy(a => a.DayOfWeek)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return slots.Select(MapSlotToDto).ToList();
    }

    public async Task<List<AvailabilitySlotDto>> SetAvailabilityAsync(string userId, SetAvailabilityDto dto)
    {
        var profile = await _db.WorkerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        // Validate all slots: StartTime < EndTime
        foreach (var slot in dto.Slots)
        {
            var start = TimeOnly.Parse(slot.StartTime);
            var end   = TimeOnly.Parse(slot.EndTime);
            if (start >= end)
                throw new InvalidOperationException(
                    $"Day {slot.DayOfWeek}: StartTime ({slot.StartTime}) must be earlier than EndTime ({slot.EndTime}).");
        }

        // Atomic replace: delete existing, insert new — all in one transaction
        await using var tx = await _db.Database.BeginTransactionAsync();

        var existing = await _db.WorkerAvailabilities
            .Where(a => a.WorkerId == profile.Id)
            .ToListAsync();

        _db.WorkerAvailabilities.RemoveRange(existing);

        var newSlots = dto.Slots.Select(s => new WorkerAvailability
        {
            WorkerId  = profile.Id,
            DayOfWeek = s.DayOfWeek,
            StartTime = TimeOnly.Parse(s.StartTime),
            EndTime   = TimeOnly.Parse(s.EndTime)
        }).ToList();

        await _db.WorkerAvailabilities.AddRangeAsync(newSlots);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return newSlots.OrderBy(a => a.DayOfWeek).ThenBy(a => a.StartTime)
                       .Select(MapSlotToDto).ToList();
    }

    private static AvailabilitySlotDto MapSlotToDto(WorkerAvailability slot) =>
        new()
        {
            Id        = slot.Id,
            DayOfWeek = slot.DayOfWeek,
            StartTime = slot.StartTime.ToString("HH:mm"),
            EndTime   = slot.EndTime.ToString("HH:mm")
        };

    // ─────────────────────────────────────────────────────────────────────────
    // Documents
    // ────────────────────────────────────────────────────────────────────────
    public async Task<List<WorkerDocumentDto>> GetDocumentsAsync(string userId)
    {
        var profile = await _db.WorkerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        return await _db.WorkerDocuments
            .Where(d => d.WorkerId == profile.Id)
            .Select(d => new WorkerDocumentDto
            {
                Id           = d.Id,
                DocumentType = d.DocumentType,
                FileUrl      = d.FileUrl,
                Status       = d.Status
            })
            .ToListAsync();
    }

    public async Task<WorkerDocumentDto> UploadDocumentAsync(
        string userId,
        string documentType,
        Stream fileStream,
        string originalFileName,
        long fileSizeBytes)
    {
        var profile = await _db.WorkerProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        // ── File validation ───────────────────────────────────────────────────
        if (fileStream is null || fileSizeBytes == 0)
            throw new InvalidOperationException("No file was uploaded.");

        if (fileSizeBytes > MaxFileSizeBytes)
            throw new InvalidOperationException($"File exceeds the {MaxFileSizeBytes / (1024 * 1024)} MB limit.");

        // Extract and validate extension — never trust the client filename for type
        var ext = Path.GetExtension(originalFileName).TrimStart('.').ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException(
                $"File type '{ext}' is not allowed. Permitted types: {string.Join(", ", AllowedExtensions)}.");

        // Validate documentType string (basic length guard)
        if (string.IsNullOrWhiteSpace(documentType) || documentType.Length > 50)
            throw new InvalidOperationException("DocumentType must be 1-50 characters.");

        // ── Secure storage ────────────────────────────────────────────────────
        // Store under <uploadRoot>/<workerId>/<guid>.<ext>
        // Generated filename → no path traversal, no executable exposure
        var uploadRoot = _pathProvider.GetUploadRoot();
        var workerUploadDir = Path.Combine(uploadRoot, profile.Id.ToString());
        Directory.CreateDirectory(workerUploadDir);   // idempotent

        var safeFileName = $"{Guid.NewGuid():N}.{ext}";
        var filePath     = Path.Combine(workerUploadDir, safeFileName);

        await using (var dest = File.Create(filePath))
            await fileStream.CopyToAsync(dest);

        // Store the relative URL only — never the raw filesystem path
        var fileUrl = $"/uploads/worker-documents/{profile.Id}/{safeFileName}";

        // ── Persist ───────────────────────────────────────────────────────────
        var doc = new WorkerDocument
        {
            WorkerId     = profile.Id,
            DocumentType = documentType,
            FileUrl      = fileUrl,
            Status       = "Pending"    // schema default — newly submitted docs are Pending
        };

        _db.WorkerDocuments.Add(doc);
        await _db.SaveChangesAsync();

        return new WorkerDocumentDto
        {
            Id           = doc.Id,
            DocumentType = doc.DocumentType,
            FileUrl      = doc.FileUrl,
            Status       = doc.Status
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Dashboard Stats
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<WorkerDashboardStatsDto> GetDashboardStatsAsync(string userId)
    {
        var profile = await _db.WorkerProfiles
            .Include(p => p.Categories)
            .Include(p => p.WorkerAvailabilities)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            throw new KeyNotFoundException("Worker profile not found.");

        // ── Profile Completion Formula ────────────────────────────────────────
        // Each of the 5 fields below contributes 20 points to a 100-point score:
        //   1. Bio is not null/empty                → +20
        //   2. HourlyRate > 0                       → +20
        //   3. Latitude and Longitude are both set  → +20
        //   4. At least one skill assigned          → +20
        //   5. At least one availability slot set   → +20
        int completionScore = 0;
        if (!string.IsNullOrWhiteSpace(profile.Bio))               completionScore += 20;
        if (profile.HourlyRate > 0)                                completionScore += 20;
        if (profile.Latitude.HasValue && profile.Longitude.HasValue) completionScore += 20;
        if (profile.Categories.Count > 0)                          completionScore += 20;
        if (profile.WorkerAvailabilities.Count > 0)                completionScore += 20;

        var availabilityStatus = profile.WorkerAvailabilities.Count > 0 ? "Available" : "Not Set";

        return new WorkerDashboardStatsDto
        {
            VerificationStatus        = profile.VerificationStatus,
            TotalSkills               = profile.Categories.Count,
            ProfileCompletionPercentage = completionScore,
            AvailabilityStatus        = availabilityStatus,
            AverageRating             = profile.AverageRating
        };
    }
}
