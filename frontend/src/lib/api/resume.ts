import { fetchApi, ApiError, API_URL } from "./client";

export type ResumeSummary = {
  role: string;
  industry: string;
  expertise_areas: string[];
  experience_level: string;
  past_employer?: string;
  education?: string;
};

export type ResumeResponse = {
  id: string;
  filename: string;
  structured_summary: ResumeSummary | null;
  uploaded_at: string;
  raw_text_length: number;
};

/**
 * Upload a resume. Multipart form data — `fetchApi` would force JSON headers,
 * so we call `fetch` directly and then funnel the response through the same
 * error/401 handling as `fetchApi` so behavior stays consistent.
 */
export async function uploadResume(file: File): Promise<ResumeResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("postcraft_token") : null;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/users/me/resume`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("postcraft_token");
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      data?.detail || data?.error || `Upload failed: ${res.statusText}`
    );
  }

  return res.json();
}

export async function getResume(): Promise<ResumeResponse | null> {
  return fetchApi<ResumeResponse | null>("/api/users/me/resume", {
    method: "GET",
  });
}

export async function deleteResume(): Promise<{ status: string; message: string }> {
  return fetchApi<{ status: string; message: string }>("/api/users/me/resume", {
    method: "DELETE",
  });
}
