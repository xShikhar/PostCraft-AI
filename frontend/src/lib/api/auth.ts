import { fetchApi } from "./client";

export async function login(username: string, password: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  return fetchApi<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export async function signup(username: string, password: string): Promise<{ access_token: string }> {
  return fetchApi<{ access_token: string }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
