using Karigor.Application.Worker.DTOs;

namespace Karigor.Application.Worker;

/// <summary>
/// All Worker module operations.
/// Every method receives the authenticated user's ApplicationUser.Id (JWT sub)
/// and resolves the WorkerProfile internally — no client-supplied WorkerProfile ID is trusted.
/// </summary>
public interface IWorkerService
{
    // ── Profile ──────────────────────────────────────────────────────────────
    Task<WorkerProfileDto>  GetProfileAsync(string userId);
    Task<WorkerProfileDto>  UpdateProfileAsync(string userId, UpdateWorkerProfileDto dto);

    // ── Skills ────────────────────────────────────────────────────────────────
    Task<List<SkillDto>>    GetSkillsAsync(string userId);
    Task<List<SkillDto>>    AddSkillsAsync(string userId, AddSkillsDto dto);
    Task                    RemoveSkillAsync(string userId, int categoryId);

    // ── Availability ─────────────────────────────────────────────────────────
    Task<List<AvailabilitySlotDto>> GetAvailabilityAsync(string userId);
    Task<List<AvailabilitySlotDto>> SetAvailabilityAsync(string userId, SetAvailabilityDto dto);

    // ── Documents ────────────────────────────────────────────────────────────
    Task<List<WorkerDocumentDto>> GetDocumentsAsync(string userId);
    /// <summary>Upload a document by providing its content as a Stream.</summary>
    /// <param name="userId">JWT sub (ApplicationUser.Id).</param>
    /// <param name="documentType">Type label (e.g. "NationalId").</param>
    /// <param name="fileStream">The file content stream.</param>
    /// <param name="originalFileName">Original filename — used only to extract the extension.</param>
    /// <param name="fileSizeBytes">Pre-validated file size in bytes.</param>
    Task<WorkerDocumentDto> UploadDocumentAsync(
        string userId,
        string documentType,
        Stream fileStream,
        string originalFileName,
        long fileSizeBytes);

    // ── Dashboard ────────────────────────────────────────────────────────────
    Task<WorkerDashboardStatsDto> GetDashboardStatsAsync(string userId);
}
