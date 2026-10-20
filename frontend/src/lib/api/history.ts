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
  draft_1?: string | null;
  draft_2?: string | null;
  draft_3?: string | null;
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
  status?: "generating" | "editing" | "needs_review" | "failed" | "finalized";
  sort?: "newest" | "oldest";
};

export async function listGenerations(params: HistoryListParams = {}): Promise<HistoryListResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  if (params.platform) search.set("platform", params.platform);
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.sort) search.set("sort", params.sort);

  const qs = search.toString();
  return fetchApi<HistoryListResponse>(`/api/generations${qs ? `?${qs}` : ""}`);
}

export type ChatMessage = { role: "user" | "assistant"; content: string; draft_index?: number };

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
  sources: { title: string; snippet: string; url: string }[];
  original_drafts?: Partial<Record<"draft_1" | "draft_2" | "draft_3", string>> | null;
  research_source?: string | null;
  research_confidence?: "low" | "medium" | "high" | null;
  research_retrieved_at?: string | null;
  quality?: { accepted_warnings?: boolean; review_unavailable?: boolean; result: string; substance_score?: number | null; scope?: "generation" | "draft"; draft_index?: number } | null;
};

export async function getGenerationFull(id: string): Promise<GenerationFull> {
  return fetchApi<GenerationFull>(`/api/generations/${id}/full`);
}

export type GenerationMetrics = { total: number; finalized: number; in_progress: number; recent_dates: string[] };
export function getGenerationMetrics() {
  return fetchApi<GenerationMetrics>("/api/generations/metrics");
}


export async function deleteGeneration(id: string): Promise<void> {
  await fetchApi<null>(`/api/generations/${id}`, { method: "DELETE" });
}
