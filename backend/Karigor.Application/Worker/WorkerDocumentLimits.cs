namespace Karigor.Application.Worker;

public static class WorkerDocumentLimits
{
    public const long MaxFileSizeBytes = 5 * 1024 * 1024;
    // File bytes plus a bounded allowance for multipart headers and form fields.
    public const long MaxRequestSizeBytes = MaxFileSizeBytes + 64 * 1024;
}
