import { fetchApi } from "./client";

export type HistoryItem = {
  generation_id: string;
  project_id: string;
  topic: string;
  platform: string;
  status: string;
  active_draft_index: number;
  created_at: string | null;
  preview: string;
};

export type HistoryListResponse = {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type HistoryListParams = {
  limit?: number;
  offset?: number;
  platform?: string;
  q?: string;
};

export async function listGenerations(params: HistoryListParams = {}): Promise<HistoryListResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  if (params.platform) search.set("platform", params.platform);
  if (params.q) search.set("q", params.q);

  const qs = search.toString();
  return fetchApi<HistoryListResponse>(`/api/generations${qs ? `?${qs}` : ""}`);
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type GenerationFull = {
  generation_id: string;
  project_id: string;
  topic: string;
  raw_thoughts: string;
  platform: string;
  status: string;
  active_draft_index: number;
  draft_1: string | null;
  draft_2: string | null;
  draft_3: string | null;
  created_at: string | null;
  updated_at: string | null;
  chat_history: ChatMessage[];
};

export async function getGenerationFull(id: string): Promise<GenerationFull> {
  return fetchApi<GenerationFull>(`/api/generations/${id}/full`);
}
