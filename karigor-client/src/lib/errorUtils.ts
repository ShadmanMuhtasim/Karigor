/**
 * Utility to extract user-friendly error messages from API and network errors.
 */
export function extractErrorMessage(
  err: any,
  fallback = 'Registration failed. Please check your details and try again.'
): string {
  if (!err) return fallback;

  // 1. Vite Proxy 502/504 when backend server is stopped
  if (err.response?.status === 502 || err.response?.status === 504) {
    return 'Backend server is not running (HTTP 502 Bad Gateway). Please start the backend in a terminal with: dotnet run --project backend/Karigor.Api';
  }

  // 2. Check if backend returned structured response
  if (err.response?.data) {
    const data = err.response.data;

    // String response
    if (typeof data === 'string') return data;

    // Direct error field (e.g. { error: "An account with that email already exists." })
    if (data.error) return data.error;

    // Standard ASP.NET ModelState validation dictionary { errors: { Password: ["..."], Email: ["..."] } }
    if (data.errors && typeof data.errors === 'object') {
      const messages: string[] = [];
      for (const key of Object.keys(data.errors)) {
        const val = data.errors[key];
        if (Array.isArray(val)) {
          messages.push(...val);
        } else if (typeof val === 'string') {
          messages.push(val);
        }
      }
      if (messages.length > 0) return messages.join(' ');
    }

    // Direct message field
    if (data.message) return data.message;

    // ProblemDetails title
    if (data.title) return data.title;
  }

  // 2. Network / Proxy errors (e.g. Backend is not running)
  if (err.message) {
    if (
      err.message === 'Network Error' ||
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNREFUSED'
    ) {
      return 'Cannot connect to the backend server. Please ensure the backend is running at http://localhost:5253 (run "dotnet run --project backend/Karigor.Api").';
    }
    return err.message;
  }

  return fallback;
}
