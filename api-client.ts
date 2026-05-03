/**
 * CVCraft API Client
 * Drop this into your frontend: src/lib/api.ts
 * Usage: import { api } from "@/lib/api"
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── TOKEN STORAGE ────────────────────────────────────────────────────────────
let _token: string | null = localStorage.getItem("cvcraft_token");

export const setToken = (token: string | null) => {
  _token = token;
  if (token) localStorage.setItem("cvcraft_token", token);
  else localStorage.removeItem("cvcraft_token");
};

export const getToken = () => _token;

// ─── BASE FETCH ───────────────────────────────────────────────────────────────
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (resp.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Session expired — please log in again");
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || `API error ${resp.status}`);
  return data as T;
}

async function download(path: string, filename: string) {
  const headers: Record<string, string> = {};
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const resp = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: JSON.stringify({}) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || "Download failed");
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string, fullName?: string) =>
    request<{ user: any; session: any }>("/auth/register", {
      method: "POST", body: JSON.stringify({ email, password, full_name: fullName }),
    }),

  login: async (email: string, password: string) => {
    const data = await request<{ user: any; session: { access_token: string; refresh_token: string } }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    setToken(data.session.access_token);
    return data;
  },

  me: () => request<{ id: string; email: string; plan: string }>("/auth/me"),

  logout: () => { setToken(null); window.location.href = "/"; },
};

// ─── RESUMES ──────────────────────────────────────────────────────────────────
export const resumes = {
  list: () => request<{ resumes: any[]; count: number; plan: string }>("/resumes"),

  create: (data: any) => request<{ resume: any }>("/resumes", {
    method: "POST", body: JSON.stringify(data),
  }),

  get: (id: string) => request<any>(`/resumes/${id}`),

  update: (id: string, data: any) => request<{ resume: any }>(`/resumes/${id}`, {
    method: "PUT", body: JSON.stringify(data),
  }),

  delete: (id: string) => request<void>(`/resumes/${id}`, { method: "DELETE" }),
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────
export const exports = {
  pdf: async (resumeIdOrData: string | object, filename = "resume.pdf") => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (_token) headers["Authorization"] = `Bearer ${_token}`;
    const body = typeof resumeIdOrData === "string"
      ? { resume_id: resumeIdOrData }
      : { resume_data: resumeIdOrData };
    const resp = await fetch(`${BASE_URL}/export/pdf`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || "PDF export failed");
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  docx: async (resumeIdOrData: string | object, filename = "resume.docx") => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (_token) headers["Authorization"] = `Bearer ${_token}`;
    const body = typeof resumeIdOrData === "string"
      ? { resume_id: resumeIdOrData }
      : { resume_data: resumeIdOrData };
    const resp = await fetch(`${BASE_URL}/export/docx`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || "DOCX export failed");
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const ai = {
  bullets: (jobTitle: string, company?: string, jobDescription?: string, count = 5) =>
    request<{ bullets: string[] }>("/ai/bullets", {
      method: "POST",
      body: JSON.stringify({ job_title: jobTitle, company, job_description: jobDescription, count }),
    }),

  summary: (jobTitle: string, experience: any[], skills: string[]) =>
    request<{ summary: string }>("/ai/summary", {
      method: "POST",
      body: JSON.stringify({ job_title: jobTitle, experience, skills }),
    }),

  skills: (jobTitle: string, count = 12) =>
    request<{ skills: string[] }>("/ai/skills", {
      method: "POST",
      body: JSON.stringify({ job_title: jobTitle, count }),
    }),

  match: (resumeData: object, jobDescription: string) =>
    request<{ score: number; label: string; tips: string[]; strengths: string[]; missing_keywords: string[] }>("/ai/match", {
      method: "POST",
      body: JSON.stringify({ resume_data: resumeData, job_description: jobDescription }),
    }),
};

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const payments = {
  initialize: (plan: "pro" | "lifetime", email: string) =>
    request<{ authorization_url: string; access_code: string; reference: string }>("/payments/initialize", {
      method: "POST",
      body: JSON.stringify({ plan, email }),
    }),

  verify: (reference: string, plan: string) =>
    request<{ success: boolean; plan: string; message: string }>("/payments/verify", {
      method: "POST",
      body: JSON.stringify({ reference, plan }),
    }),
};

// ─── USER ─────────────────────────────────────────────────────────────────────
export const user = {
  subscription: () => request<{ plan: string; details: any }>("/user/subscription"),
  stats: () => request<{ plan: string; resume_count: number; downloads_today: number; limits: any }>("/user/stats"),
};

// ─── CONVENIENCE HOOK (React) ──────────────────────────────────────────────────
export const api = { auth, resumes, exports, ai, payments, user };
export default api;
