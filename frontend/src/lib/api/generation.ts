import { fetchApi } from "./client";

export type GenerationParams = {
  topic: string;
  platform: string;
  raw_thoughts: string;
  profile_context?: string;
};

export type Drafts = {
  draft_1: string;
  draft_2: string;
  draft_3: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type SourceItem = {
  title: string;
  snippet: string;
  url: string;
};

export type GenerationResponse = {
  generation_id: string;
  draft_1: string;
  draft_2: string;
  draft_3: string;
  sources?: SourceItem[];
  research_confidence?: "low" | "medium" | "high";
  research_source?: string;
  status: "editing" | "needs_review" | "failed";
  error?: string;
};

export async function generateDrafts(params: GenerationParams): Promise<GenerationResponse> {
  const data = await fetchApi<GenerationResponse>("/api/generations", {
    method: "POST",
    body: JSON.stringify(params),
  });
  
  if (data.status === "failed") {
    throw new Error(data.error || "Generation failed in the pipeline.");
  }
  
  return data;
}

export async function editDraft(generationId: string, draftIndex: number, instruction: string) {
  return fetchApi<{ revised_draft: string }>(`/api/generations/${generationId}/edit`, {
    method: "POST",
    body: JSON.stringify({ instruction, draft_index: draftIndex }),
  });
}

export async function finalizeDraft(generationId: string, finalDraftIndex: number) {
  return fetchApi<{ status: string }>(`/api/generations/${generationId}/finalize`, {
    method: "POST",
    body: JSON.stringify({ final_draft_index: finalDraftIndex }),
  });
}
