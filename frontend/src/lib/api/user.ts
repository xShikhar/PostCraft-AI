import { fetchApi } from "./client";

export type UserResponse = {
  id: string;
  username: string;
  profile_context?: string;
};

export type UserUpdate = {
  profile_context?: string;
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
