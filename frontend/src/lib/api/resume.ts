import { fetchApi } from "./client";

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
  raw_text: string;
};

/**
 * Upload a resume. Multipart form data — `fetchApi` would force JSON headers,
 * so we call `fetch` directly and then funnel the response through the same
 * error/401 handling as `fetchApi` so behavior stays consistent.
 */
export async function uploadResume(file: File): Promise<ResumeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<ResumeResponse>("/api/users/me/resume", { method: "POST", body: formData });
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

export async function updateResume(raw_text: string) {
  return fetchApi<ResumeResponse>("/api/users/me/resume", { method: "PATCH", body: JSON.stringify({ raw_text }) });
}
