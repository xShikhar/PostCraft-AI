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
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail || data?.error || `Upload failed: ${res.statusText}`);
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
