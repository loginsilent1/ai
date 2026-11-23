import { Capacitor } from "@capacitor/core";
import { getClientId } from "./storage";
import type { AccountStatus, GenerateResult, HealthStatus, Mode, Role, SearchSource } from "../types";

interface GenerateOptions {
  prompt: string;
  mode: Mode;
  history: Array<{ role: Role; content: string }>;
  file?: File | null;
  signal?: AbortSignal;
}

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const apiBase = configuredBase?.replace(/\/+$/, "") ?? "";

function apiUrl(path: string): string {
  if (
    !apiBase &&
    (Capacitor.isNativePlatform() ||
      (typeof window !== "undefined" &&
        (window.location.protocol === "capacitor:" || window.location.protocol === "file:")))
  ) {
    throw new Error("This Android build needs an HTTPS VITE_API_BASE_URL before release.");
  }
  return `${apiBase}${path}`;
}

async function requestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "X-Client-ID": getClientId() };
  const firebaseConfigured = [
    import.meta.env.VITE_FIREBASE_API_KEY,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    import.meta.env.VITE_FIREBASE_APP_ID,
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ].every(Boolean);
  if (firebaseConfigured) {
    const { getIdToken } = await import("./firebase");
    const token = await getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(apiUrl("/api/health"), { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error("The API is not reachable right now.");
  return (await response.json()) as HealthStatus;
}

export async function fetchAccount(): Promise<AccountStatus> {
  const response = await fetch(apiUrl("/api/account"), {
    method: "GET",
    headers: await requestHeaders(),
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Could not load account usage.");
  return (await response.json()) as AccountStatus;
}

export async function generateReply(options: GenerateOptions): Promise<GenerateResult> {
  const form = new FormData();
  form.append("prompt", options.prompt);
  form.append("mode", options.mode);
  form.append("history_json", JSON.stringify(options.history.slice(-12)));
  if (options.file) form.append("file", options.file, options.file.name);

  let response: Response;
  try {
    response = await fetch(apiUrl("/api/generate"), {
      method: "POST",
      headers: await requestHeaders(),
      body: form,
      signal: options.signal,
      credentials: "omit",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach the Argon server. Check your connection and API setup.");
  }

  const payload = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
    mode?: Mode;
    plan?: "free" | "pro";
    provider_used?: string;
    reply?: string;
    remaining_today?: number;
    sources?: SearchSource[];
  };

  if (!response.ok) {
    const fallback = response.status === 401
      ? "Your sign-in expired. Reopen the app or sign in again."
      : response.status === 429
        ? "You have reached today's message limit. Try again after the daily reset."
        : "The assistant could not complete that request.";
    throw new Error(errorMessage(payload.detail, fallback));
  }

  if (!payload.reply || !payload.mode || !payload.provider_used) {
    throw new Error("The server returned an incomplete response.");
  }

  return {
    mode: payload.mode,
    plan: payload.plan ?? "free",
    provider_used: payload.provider_used,
    reply: payload.reply,
    remaining_today: payload.remaining_today ?? 0,
    sources: Array.isArray(payload.sources) ? payload.sources : [],
  };
}

export function getApiBaseLabel(): string {
  return apiBase || "Current app origin (dev proxy)";
}
