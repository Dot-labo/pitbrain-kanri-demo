const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "エラーが発生しました" }));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join(" / ")
      : (detail ?? "エラーが発生しました");
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  company_code: string;
  level: number;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  requestReset: (email: string) =>
    request("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  confirmReset: (token: string, new_password: string) =>
    request("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),
  me: () => request<CurrentUser>("/auth/me"),
};

// Companies
export const companies = {
  list: () => request<import("@/types").Company[]>("/companies"),
  get: (id: number) => request<import("@/types").Company>(`/companies/${id}`),
  create: (data: unknown) =>
    request<import("@/types").Company>("/companies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: unknown) =>
    request<import("@/types").Company>(`/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<void>(`/companies/${id}`, { method: "DELETE" }),
  licenseSummary: (id: number) =>
    request<import("@/types").LicenseSummary>(`/companies/${id}/license-summary`),
};

// Workers
export const workers = {
  list: (params?: { company_id?: number; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<import("@/types").Worker[]>(`/workers${qs ? `?${qs}` : ""}`);
  },
  pendingRequests: () => request<import("@/types").LicenseRequest[]>("/workers/pending"),
  approve: (requestId: number) =>
    request(`/workers/requests/${requestId}/approve`, { method: "POST" }),
  reject: (requestId: number, reason?: string) =>
    request(`/workers/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  apply: (data: { company_id: number; branch_id?: number; name: string }) =>
    request("/workers/apply", { method: "POST", body: JSON.stringify(data) }),
  create: (data: { company_id: number; branch_id?: number; name: string }) =>
    request<import("@/types").Worker>("/workers/create", { method: "POST", body: JSON.stringify(data) }),
  update: (workerId: number, data: { name?: string; branch_id?: number | null; status?: string }) =>
    request<import("@/types").Worker>(`/workers/${workerId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deactivate: (workerId: number) =>
    request(`/workers/${workerId}/deactivate`, { method: "POST" }),
};

// Licenses
export const licenses = {
  list: () => request<import("@/types").License[]>("/licenses"),
  apply: (data: { company_id: number; branch_id?: number }) =>
    request<import("@/types").License>("/licenses", { method: "POST", body: JSON.stringify(data) }),
  assign: (licenseId: string, data: { branch_id: number | null; worker_id: number | null }) =>
    request<import("@/types").License>(`/licenses/${licenseId}/assign`, { method: "PATCH", body: JSON.stringify(data) }),
  suspend: (licenseId: string) =>
    request<import("@/types").License>(`/licenses/${licenseId}/suspend`, { method: "POST" }),
  cancel: (licenseId: string) =>
    request<import("@/types").License>(`/licenses/${licenseId}/cancel`, { method: "POST" }),
};

// Billing
export const billing = {
  list: (target_month?: string) => {
    const qs = target_month ? `?target_month=${target_month}` : "";
    return request<import("@/types").BillingRecord[]>(`/billing${qs}`);
  },
  snapshot: (target_month: string) =>
    request(`/billing/snapshot?target_month=${target_month}`, { method: "POST" }),
  update: (id: number, data: unknown) =>
    request<import("@/types").BillingRecord>(`/billing/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  my: () =>
    request<import("@/types").BillingRecord[]>(`/billing/my`),
  live: () =>
    request<{ company_id: number; license_count: number }[]>(`/billing/live`),
  ensure: (company_id: number, target_month: string) =>
    request<import("@/types").BillingRecord>(
      `/billing/ensure?company_id=${company_id}&target_month=${target_month}`,
      { method: "POST" }
    ),
};
