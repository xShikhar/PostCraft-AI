import { fetchApi } from "./client";

export type UserResponse = {
  id: string;
  username: string;
  is_admin: boolean;
  profile_context?: string;
  about_me?: string;
  writing_style?: string;
};

export type UserUpdate = {
  profile_context?: string;
  about_me?: string;
  writing_style?: string;
};

export async function getCurrentUser(): Promise<UserResponse> {
  return fetchApi<UserResponse>("/api/users/me", {
    method: "GET",
  });
}

export async function updateCurrentUser(data: UserUpdate): Promise<UserResponse> {
  return fetchApi<UserResponse>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Account deletion — server cascades DB rows + ChromaDB vectors.
// Returns void on 204 success; the server may also return a small JSON body.
export async function deleteMyAccount(): Promise<{ status: string; message: string }> {
  return fetchApi<{ status: string; message: string }>("/api/users/me", {
    method: "DELETE",
  });
}

