using System;
using System.IO;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Karigor.Abstractions.Worker;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Karigor.Application.Worker;

namespace Karigor.Api.Controllers;

/// <summary>
/// Secure streaming endpoint for worker verification documents.
/// Files live in a private folder (<c>App_Data/Uploads/WorkerDocuments</c>) outside
/// the static-file pipeline and are ONLY reachable through this authenticated
/// endpoint. Access rules:
///   * The worker themselves (JWT sub == WorkerProfile.UserId), or
///   * Any Admin (audit / verification).
/// The <c>fileId</c> segment is constrained to a 32-char GUID plus a 1-8 char
/// lowercase extension — this structurally blocks path-traversal payloads
/// ("../..") that would otherwise escape the upload root.
/// </summary>
[ApiController]
[Route("uploads/worker-documents/{workerId:int}/{fileId}")]
[EnableRateLimiting("PublicLimiter")]
public class WorkerDocumentFileController : ControllerBase
{
    // <32-char lowercase hex GUID>.<1-8 lowercase alphanumeric extension>
    private static readonly Regex FileIdPattern =
        new(@"\A[0-9a-f]{32}\.[a-z0-9]{1,8}\z", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly System.Collections.Generic.Dictionary<string, (string ContentType, string Disposition)> ExtToMeta =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"]  = ("application/pdf", "inline"),
            [".jpg"]  = ("image/jpeg",      "inline"),
            [".jpeg"] = ("image/jpeg",      "inline"),
            [".png"]  = ("image/png",       "inline"),
        };

    private readonly KarigorDbContext _db;
    private readonly IUploadPathProvider _pathProvider;
    private readonly ILogger<WorkerDocumentFileController> _logger;

    public WorkerDocumentFileController(
        KarigorDbContext db,
        IUploadPathProvider pathProvider,
        ILogger<WorkerDocumentFileController> logger)
    {
        _db           = db;
        _pathProvider = pathProvider;
        _logger       = logger;
    }

    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDocumentFile(int workerId, string fileId)
    {
        // 1. Structurally block traversal
        if (string.IsNullOrWhiteSpace(fileId) || !FileIdPattern.IsMatch(fileId))
            return NotFound();

        // 2. Authorization: owner or admin
        if (User?.Identity?.IsAuthenticated != true)
            return Unauthorized();

        var requestingUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(requestingUserId))
            return Unauthorized();

        var isAdmin = User.IsInRole("Admin");

        var profile = await _db.WorkerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == workerId);
        if (profile is null)
            return NotFound();   // do not leak existence

        if (!isAdmin && profile.UserId != requestingUserId)
            return NotFound();   // 404 instead of 403 to avoid existence oracle

        // 3. Verify a DB row exists for this exact (workerId, fileId) pair
        var expectedUrl = $"/uploads/worker-documents/{workerId}/{fileId}";
        var doc = await _db.WorkerDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.WorkerId == workerId && d.FileUrl == expectedUrl);
        if (doc is null)
            return NotFound();

        // 4. Resolve physical path with traversal guard
        var uploadRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(_pathProvider.GetUploadRoot()));
        var filePath   = Path.GetFullPath(
            Path.Combine(uploadRoot, workerId.ToString(), Path.GetFileName(fileId)));

        if (!filePath.StartsWith(uploadRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            _logger.LogWarning("Rejected file retrieval attempt — path escaped upload root: {FilePath}", filePath);
            return NotFound();
        }

        if (!System.IO.File.Exists(filePath))
            return NotFound();

        // 5. Pick content type + disposition
        var ext = System.IO.Path.GetExtension(fileId).ToLowerInvariant();
        if (!ExtToMeta.TryGetValue(ext, out var meta))
            return NotFound();

        // 6. Stream back with secure headers
        // MVC owns the stream after return; do not dispose it in the action's scope.
        System.IO.FileStream stream;
        try
        {
            var workerDirectory = new DirectoryInfo(Path.GetDirectoryName(filePath)!);
            if ((workerDirectory.Attributes & FileAttributes.ReparsePoint) != 0 ||
                (System.IO.File.GetAttributes(filePath) & FileAttributes.ReparsePoint) != 0) return NotFound();
            stream = new System.IO.FileStream(filePath, System.IO.FileMode.Open, System.IO.FileAccess.Read,
                System.IO.FileShare.Read, bufferSize: 81920, useAsync: true);
        }
        catch (IOException) { return NotFound(); }
        catch (UnauthorizedAccessException) { return NotFound(); }

        try
        {
            if (stream.Length == 0 || stream.Length > WorkerDocumentLimits.MaxFileSizeBytes ||
                !FileValidationService.ValidateStream(stream, ext.TrimStart('.'), out _))
            {
                await stream.DisposeAsync();
                return NotFound();
            }

            // MVC disposes the transferred stream after result execution.
            var result = new FileStreamResult(stream, meta.ContentType);
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "no-store";
            Response.Headers["Content-Disposition"] =
                $"{meta.Disposition}; filename=\"{Uri.EscapeDataString(Path.GetFileName(fileId))}\"";

            return result;
        }
        catch
        {
            await stream.DisposeAsync();
            throw;
        }
    }
}
