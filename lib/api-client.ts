export interface ApiEnvelope<T> { success: boolean; data: T | null; error: { code: string; message: string } | null; request_id: string }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.success || payload.data === null) throw new Error(payload.error?.message ?? "Request failed");
  return payload.data;
}

export const apiClient = {
  login: (password: string) => request<{ authenticated: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ authenticated: boolean }>("/api/auth/logout", { method: "POST" }),
  session: () => request<{ authenticated: boolean; expires_at: string }>("/api/auth/session"),
  projects: () => request<unknown[]>("/api/projects"),
};

