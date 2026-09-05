export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("postcraft_token") : null;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("postcraft_token");
      // Trigger a custom event so the UI can listen and log out
      window.dispatchEvent(new Event("auth-expired"));
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Surface 429s with a dedicated, honest message. We prefer the server's
    // "detail" when it exists (slowapi sends a useful one), but always augment
    // with the parsed Retry-After hint if the server provides one. Without
    // that header we still tell the user this is a rate limit — better than
    // pretending it's a generic 5xx.
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      const baseMessage =
        data?.detail || data?.error || "You're doing that a little too quickly.";
      const hint = retryAfter
        ? ` Please wait ${formatRetryAfter(retryAfter)} and try again.`
        : " Please wait a few minutes and try again.";
      throw new ApiError(429, baseMessage + hint, retryAfter);
    }
    throw new ApiError(
      response.status,
      data?.detail || data?.error || `API Error: ${response.statusText}`
    );
  }

  return data as T;
}

// Retry-After can be either seconds (integer) or an HTTP-date.
// We only render the seconds form in toasts; the caller still gets the raw
// value in ApiError.retryAfter if they want to do something more sophisticated.
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.round((date - Date.now()) / 1000));
  }
  return undefined;
}

function formatRetryAfter(seconds: number): string {
  if (seconds <= 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
