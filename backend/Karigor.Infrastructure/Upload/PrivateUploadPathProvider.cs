using System;
using System.IO;
using Karigor.Abstractions.Worker;

namespace Karigor.Infrastructure.Upload
{
    /// <summary>
    /// Resolves the worker-documents upload root to a location OUTSIDE the
    /// web root (configured path or ContentRoot/App_Data/Uploads/WorkerDocuments), so that
    /// ASP.NET Core's UseStaticFiles middleware can never serve uploaded
    /// files directly. The only way to read an uploaded file is through
    /// the authenticated streaming endpoint exposed by WorkerDocumentFileController.
    /// </summary>
    public sealed class PrivateUploadPathProvider : IUploadPathProvider
    {
        private readonly string _uploadRoot;

        public PrivateUploadPathProvider(string contentRootPath, string? configuredUploadPath = null, string? webRootPath = null)
        {
            if (string.IsNullOrWhiteSpace(contentRootPath))
                throw new ArgumentException("contentRootPath must be provided.", nameof(contentRootPath));

            var contentRoot = Path.GetFullPath(contentRootPath);
            _uploadRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(
                string.IsNullOrWhiteSpace(configuredUploadPath)
                    ? Path.Combine(contentRoot, "App_Data", "Uploads", "WorkerDocuments")
                    : Path.IsPathRooted(configuredUploadPath) ? configuredUploadPath : Path.Combine(contentRoot, configuredUploadPath)));
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            foreach (var publicRoot in new[] { Path.Combine(contentRoot, "wwwroot"), webRootPath })
            {
                if (string.IsNullOrWhiteSpace(publicRoot)) continue;
                var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(publicRoot));
                RejectLinks(root);
                if (_uploadRoot.Equals(root, comparison) || _uploadRoot.StartsWith(root + Path.DirectorySeparatorChar, comparison))
                    throw new InvalidOperationException("Private document storage must be outside the public web root.");
            }
            RejectLinks(_uploadRoot);
        }

        // Canonical strings alone do not protect against a configured junction/symlink.
        private static void RejectLinks(string path)
        {
            for (var directory = new DirectoryInfo(path); directory is not null; directory = directory.Parent)
                if (directory.Exists && (directory.Attributes & FileAttributes.ReparsePoint) != 0)
                    throw new InvalidOperationException("Private document storage cannot use linked directories.");
        }

        public string GetUploadRoot()
        {
            RejectLinks(_uploadRoot);
            if (!Directory.Exists(_uploadRoot))
                Directory.CreateDirectory(_uploadRoot);
            return _uploadRoot;
        }
    }
}
