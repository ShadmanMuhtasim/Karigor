namespace Karigor.Application.Worker.DTOs;

/// <summary>
/// Returned by GET /api/worker/documents.
/// Path-traversal-safe: FileUrl is the server-side relative URL, not the raw filesystem path.
/// </summary>
public class WorkerDocumentDto
{
    public int    Id           { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl      { get; set; } = string.Empty;
    public string Status       { get; set; } = string.Empty;
}
