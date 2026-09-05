import { fetchApi } from "./client";

export type StyleProfileDimensions = {
  id: string;
  platform: string;
  structure: string | null;
  tone: string | null;
  pacing: string | null;
  storytelling_technique: string | null;
  formatting: string | null;
  cta_style: string | null;
  created_at: string | null;
};

export type StyleProfileHistoryEntry = {
  id: string;
  platform: string;
  created_at: string | null;
};

export type StyleProfileResponse = {
  current: StyleProfileDimensions | null;
  history: StyleProfileHistoryEntry[];
  message?: string;
};

export async function getStyleProfile(platform?: string): Promise<StyleProfileResponse> {
  const params = platform ? `?platform=${platform}` : "";
  return fetchApi<StyleProfileResponse>(`/api/users/me/style-profile${params}`);
}
