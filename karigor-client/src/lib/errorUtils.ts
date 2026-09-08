/**
 * Technical / internal patterns that should NEVER be displayed raw to users.
 */
const TECHNICAL_PATTERNS = [
  /execution\s*strategy/i,
  /sqlserver/i,
  /dbcontext/i,
  /entity\s*framework/i,
  /microsoft\.entityframeworkcore/i,
  /sqlexception/i,
  /stack\s*trace/i,
  /\bat\s+system\./i,
  /\bat\s+microsoft\./i,
  /\bat\s+karigor\./i,
  /nullreference/i,
  /invalidoperationexception/i,
  /foreign\s*key\s*constraint/i,
  /syntax\s*error\s*near/i,
  /begintransaction/i,
  /timeout\s*expired/i,
  /transactionaborted/i,
  /object\s*reference\s*not\s*set/i,
  /unhandled\s*exception/i,
  /\b(select|insert|update|delete)\s+from\b/i,
  /connection\s*string/i,
  /line\s+\d+:\s*incorrect\s*syntax/i,
  /indexoutofrange/i,
  /argumentnull/i,
];

/**
 * Returns true if the message appears to be a raw internal / technical exception.
 */
export function isTechnicalError(msg: unknown): boolean {
  if (!msg || typeof msg !== 'string') return false;
  const trimmed = msg.trim();
  if (!trimmed) return false;

  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  // Abnormally long messages (> 200 chars) with class or code identifiers
  if (
    trimmed.length > 200 &&
    (trimmed.includes('Exception') || trimmed.includes('System.') || trimmed.includes('line '))
  ) {
    return true;
  }

  return false;
}

/**
 * Utility to extract user-friendly error messages from API and network errors.
 */
export function extractErrorMessage(
  err: any,
  fallback = 'Registration failed. Please check your details and try again.'
): string {
  if (!err) return fallback;

  function sanitize(message: string): string {
    if (!message || typeof message !== 'string') return fallback;
    const trimmed = message.trim();
    if (isTechnicalError(trimmed)) {
      return fallback;
    }
    return trimmed;
  }

  // 1. Vite Proxy 502/504 when backend server is stopped
  if (err.response?.status === 502 || err.response?.status === 504) {
    return 'Backend server is not running (HTTP 502 Bad Gateway). Please start the backend in a terminal with: dotnet run --project backend/Karigor.Api';
  }

  // 2. Check if backend returned structured response
  if (err.response?.data) {
    const data = err.response.data;

    // String response
    if (typeof data === 'string') return sanitize(data);

    // Direct error field (e.g. { error: "An account with that email already exists." })
    if (data.error) return sanitize(data.error);

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
      if (messages.length > 0) return sanitize(messages.join(' '));
    }

    // Direct message field
    if (data.message) return sanitize(data.message);

    // ProblemDetails title
    if (data.title) return sanitize(data.title);
  }

  // 3. Network / Proxy errors (e.g. Backend is not running)
  if (err.message) {
    if (
      err.message === 'Network Error' ||
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNREFUSED'
    ) {
      return 'Cannot connect to the backend server. Please ensure the backend is running at http://localhost:5253 (run "dotnet run --project backend/Karigor.Api").';
    }
    return sanitize(err.message);
  }

  return fallback;
}
