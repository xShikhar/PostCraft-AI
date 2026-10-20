import { fetchApi } from "./client";

export type GenerationParams = {
  topic: string;
  platform: string;
  raw_thoughts: string;
  profile_context?: string;
  use_context?: boolean;
};

export type Drafts = {
  draft_1: string;
  draft_2: string;
  draft_3: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string; draft_index?: number };

export type SourceItem = {
  title: string;
  snippet: string;
  url: string;
};

export type GenerationResponse = {
  generation_id: string;
  updated_at: string;
  research_retrieved_at?: string | null;
  draft_1: string;
  draft_2: string;
  draft_3: string;
  sources?: SourceItem[];
  research_confidence?: "low" | "medium" | "high";
  research_source?: string;
  status: "editing" | "needs_review" | "failed";
  substance_score?: number;
  error?: string;
};

export async function generateDrafts(params: GenerationParams): Promise<GenerationResponse> {
  const data = await fetchApi<GenerationResponse>("/api/generations", {
    method: "POST",
    body: JSON.stringify(params),
  });
  
  if (data.status === "failed" || data.error || !data.draft_1 || !data.draft_2 || !data.draft_3) {
    throw new Error(data.error || "Generation failed in the pipeline.");
  }
  
  return data;
}

export async function editDraft(generationId: string, draftIndex: number, instruction: string) {
  return fetchApi<{ revised_draft: string; reply?: string; status: string }>(`/api/generations/${generationId}/edit`, {
    method: "POST",
    body: JSON.stringify({ instruction, draft_index: draftIndex }),
  });
}

export type FinalizeQuality = { result: string; substance_score?: number | null; scope: "draft"; draft_index: number; review_token?: string; review_unavailable?: boolean; accepted_warnings?: boolean };
export type FinalizeResponse = { status: string; quality?: FinalizeQuality; updated_at?: string; warning?: string | null };
export async function finalizeDraft(generationId: string, finalDraftIndex: number, reviewToken?: string) {
  return fetchApi<FinalizeResponse>(`/api/generations/${generationId}/finalize`, {
    method: "POST",
    body: JSON.stringify({ final_draft_index: finalDraftIndex, ...(reviewToken ? { accept_warnings: true, review_token: reviewToken } : {}) }),
  });
}


export type SaveDraftResponse = {
  generation_id: string;
  draft_index: 1 | 2 | 3;
  content: string;
  updated_at: string;
  status: string;
};

export function saveDraft(generationId: string, draftIndex: number, content: string, expectedUpdatedAt: string): Promise<SaveDraftResponse> {
  return fetchApi<SaveDraftResponse>(`/api/generations/${generationId}`, {
    method: "PATCH",
    body: JSON.stringify({ draft_index: draftIndex, content, expected_updated_at: expectedUpdatedAt }),
  });
}
