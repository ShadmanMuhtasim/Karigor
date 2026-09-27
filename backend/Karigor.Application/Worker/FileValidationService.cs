using System;
using System.IO;

namespace Karigor.Application.Worker
{
    /// <summary>
    /// Magic-byte ("signature") validation for uploaded worker documents.
    /// Rejects files whose bytes do not match their declared extension.
    /// This blocks the "rename .exe → .pdf" attack where an attacker spoofs
    /// a dangerous file's extension.
    /// </summary>
    public static class FileValidationService
    {
        /// <summary>
        /// Validates the leading bytes of <paramref name="stream"/> against the
        /// expected signature for <paramref name="extension"/>.
        /// </summary>
        /// <param name="stream">Readable stream, positioned at offset 0 (or resettable to 0).</param>
        /// <param name="extension">Lower-case extension WITHOUT the dot (pdf/jpg/jpeg/png/webp).</param>
        /// <param name="expectedExt">Out parameter: the extension the bytes actually indicate, for error messages.</param>
        /// <returns>true if the bytes match the declared extension; false otherwise.</returns>
        public static bool ValidateStream(Stream stream, string extension, out string detectedExt)
        {
            detectedExt = "unknown";

            // Ensure we read from the start.
            long savedPos = 0;
            if (stream.CanSeek)
            {
                savedPos = stream.Position;
                stream.Position = 0;
            }

            try
            {
                var sig = new byte[16];
                int read = 0;
                while (read < sig.Length)
                {
                    int n = stream.Read(sig, read, sig.Length - read);
                    if (n <= 0) break;
                    read += n;
                }
                if (read < 4) return false; // too small to identify

                switch ((extension ?? string.Empty).ToLowerInvariant())
                {
                    case "pdf":
                        detectedExt = "pdf";
                        return read >= 4
                            && sig[0] == 0x25 && sig[1] == 0x46 // '%F'
                            && sig[2] == 0x44 && sig[3] == 0x50; // 'DP'   → %PDF

                    case "jpg":
                    case "jpeg":
                        detectedExt = "jpeg";
                        return read >= 3
                            && sig[0] == 0xFF && sig[1] == 0xD8 && sig[2] == 0xFF; // SOI

                    case "png":
                        detectedExt = "png";
                        return read >= 8
                            && sig[0] == 0x89 && sig[1] == 0x50 && sig[2] == 0x4E && sig[3] == 0x47
                            && sig[4] == 0x0D && sig[5] == 0x0A && sig[6] == 0x1A && sig[7] == 0x0A;

                    case "webp":
                        detectedExt = "webp";
                        return read >= 12
                            && sig[0] == 'R' && sig[1] == 'I' && sig[2] == 'F' && sig[3] == 'F'
                            && sig[8] == 'W' && sig[9] == 'E' && sig[10] == 'B' && sig[11] == 'P';

                    default:
                        detectedExt = "unknown";
                        return false; // unknown extension → reject
                }
            }
            finally
            {
                // Reset to original position so the caller's subsequent copy
                // (e.g. CopyToAsync to the destination) reads the whole file.
                if (stream.CanSeek)
                    stream.Position = savedPos;
            }
        }
    }
}
