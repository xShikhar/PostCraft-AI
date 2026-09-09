export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message);
    this.name = "ApiError";
  }
}

// Long-running endpoints (e.g. /api/generations pipeline) get a longer
// client-side timeout. Default 1 minute for most routes; 10 minutes for
// the generation pipeline (Research + Pattern + 3× Draft LLM calls +
// Quality + retry, with margin). Other endpoints use 60s.
const DEFAULT_TIMEOUT_MS = 60_000;
const LONG_RUNNING_TIMEOUT_MS = 600_000;

function timeoutFor(endpoint: string): number {
  return endpoint.startsWith("/api/generations") ? LONG_RUNNING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("postcraft_token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Wrap fetch with AbortController so a hung backend can't pin the UI in
  // the "generating..." state forever. Browsers don't apply any default
  // timeout, so without this the user just sees an indefinite spinner.
  const controller = new AbortController();
  const timeoutMs = timeoutFor(endpoint);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        408,
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. The server is taking too long — try again.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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
