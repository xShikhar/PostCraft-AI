import { fetchApi } from "./client";

export interface AdminStats {
  users: {
    total: number;
    signups_last_24h: number;
    signups_last_7d: number;
    signups_last_30d: number;
  };
  generations: {
    total: number;
    generations_last_24h: number;
    generations_last_7d: number;
    generations_last_30d: number;
    platform_breakdown: Record<string, number>;
  };
}

export interface AdminUserItem {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string | null;
  generation_count: number;
  last_active_at: string | null;
}

export interface AdminUsersResponse {
  items: AdminUserItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminGenerationItem {
  generation_id: string;
  project_id: string;
  topic: string;
  raw_thoughts: string;
  platform: string;
  status: string;
  active_draft_index: number;
  preview: string;
  draft_1: string | null;
  draft_2: string | null;
  draft_3: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminUserGenerationsResponse {
  items: AdminGenerationItem[];
  total: number;
  limit: number;
  offset: number;
  user: {
    id: string;
    username: string;
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  return fetchApi<AdminStats>("/api/admin/stats");
}

export async function getAdminUsers(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminUsersResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));

  const qs = search.toString();
  return fetchApi<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getUserGenerations(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<AdminUserGenerationsResponse> {
  return fetchApi<AdminUserGenerationsResponse>(
    `/api/admin/users/${userId}/generations?limit=${limit}&offset=${offset}`
  );
}
