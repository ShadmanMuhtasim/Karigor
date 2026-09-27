using System;
using System.IO;
using Karigor.Abstractions.Worker;

namespace Karigor.Infrastructure.Upload
{
    /// <summary>
    /// Resolves the worker-documents upload root to a location OUTSIDE the
    /// web root (ContentRoot/App_Data/Uploads/WorkerDocuments), so that
    /// ASP.NET Core's UseStaticFiles middleware can never serve uploaded
    /// files directly. The only way to read an uploaded file is through
    /// the authenticated streaming endpoint exposed by WorkerDocumentFileController.
    /// </summary>
    public sealed class PrivateUploadPathProvider : IUploadPathProvider
    {
        private readonly string _uploadRoot;

        public PrivateUploadPathProvider(string contentRootPath)
        {
            if (string.IsNullOrWhiteSpace(contentRootPath))
                throw new ArgumentException("contentRootPath must be provided.", nameof(contentRootPath));

            // Use the host's content root (NOT web root) so files live outside
            // the static-files boundary.
            _uploadRoot = Path.Combine(contentRootPath, "App_Data", "Uploads", "WorkerDocuments");
        }

        public string GetUploadRoot()
        {
            // Ensure the private directory exists so WorkerService can write into it.
            if (!Directory.Exists(_uploadRoot))
                Directory.CreateDirectory(_uploadRoot);
            return _uploadRoot;
        }
    }
}
