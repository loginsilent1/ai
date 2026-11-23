import type { ChatSession, Mode } from "../types";

const SESSIONS_KEY = "argon-pocket.sessions.v1";
const CLIENT_ID_KEY = "argon-pocket.client-id.v1";
const SESSION_LIMIT = 12;
const MESSAGES_PER_SESSION = 20;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createSession(mode: Mode): ChatSession {
  const now = Date.now();
  return {
    id: newId(),
    title: mode === "app_builder" ? "New app" : mode === "agent" ? "New research task" : "New chat",
    mode,
    updatedAt: now,
    messages: [],
  };
}

export function createMessageId(): string {
  return newId();
}

export function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id = newId();
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatSession => {
        return Boolean(
          item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.updatedAt === "number" &&
            ["chat", "agent", "app_builder"].includes(item.mode) &&
            Array.isArray(item.messages),
        );
      })
      .map((session) => ({
        ...session,
        messages: session.messages.slice(-MESSAGES_PER_SESSION),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, SESSION_LIMIT);
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    const compact = [...sessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, SESSION_LIMIT)
      .map((session) => ({
        ...session,
        messages: session.messages.slice(-MESSAGES_PER_SESSION),
      }));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(compact));
  } catch {
    // Local history is optional. Do not block chat if storage is full or disabled.
  }
}
