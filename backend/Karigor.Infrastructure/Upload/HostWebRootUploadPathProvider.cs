using System;
using System.IO;
using Karigor.Abstractions.Worker;

namespace Karigor.Infrastructure.Upload
{
    public class HostWebRootUploadPathProvider : IUploadPathProvider
    {
        private readonly string _uploadRoot;
        public HostWebRootUploadPathProvider(string webRootPath)
        {
            if (string.IsNullOrWhiteSpace(webRootPath))
                throw new ArgumentException("webRootPath must be provided.", nameof(webRootPath));
            _uploadRoot = Path.Combine(webRootPath, "uploads", "worker-documents");
        }

        public string GetUploadRoot() => _uploadRoot;
    }
}
