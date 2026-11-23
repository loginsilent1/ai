export type Mode = "chat" | "agent" | "app_builder";
export type Page = "home" | "history" | "studio" | "settings" | "chat";
export type Role = "user" | "assistant";

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  mode?: Mode;
  createdAt: number;
  provider?: string;
  plan?: "free" | "pro";
  remainingToday?: number;
  sources?: SearchSource[];
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: Mode;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AccountStatus {
  plan: "free" | "pro";
  daily_limit: number;
  remaining_today: number;
}

export interface HealthStatus {
  status: "ok" | "unavailable";
  auth_mode?: "dev" | "firebase";
  providers?: {
    groq: boolean;
    gemini: boolean;
    premium: boolean;
  };
  daily_limits?: {
    free: number;
    pro: number;
  };
}

export interface GenerateResult {
  mode: Mode;
  plan: "free" | "pro";
  provider_used: string;
  reply: string;
  remaining_today: number;
  sources: SearchSource[];
}
