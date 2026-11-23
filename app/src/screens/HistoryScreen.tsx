import { ArrowUpRight, Clock3, Code2, Compass, MessageSquareText, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatSession, Mode } from "../types";

interface HistoryScreenProps {
  sessions: ChatSession[];
  onOpen: (session: ChatSession) => void;
  onNew: (mode: Mode) => void;
  onDelete: (sessionId: string) => void;
}

const modeLabels: Record<Mode, string> = {
  chat: "Chat",
  agent: "Agent",
  app_builder: "App Studio",
};

export function HistoryScreen({ sessions, onOpen, onNew, onDelete }: HistoryScreenProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(clean));
  }, [query, sessions]);

  return (
    <div className="simple-page page-scroll">
      <div className="page-topline">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR WORKSPACE</div>
        <div className="date-stamp">Stored on this device</div>
      </div>
      <div className="simple-page-heading">
        <div><div className="section-kicker">THE THREADS YOU STARTED</div><h1>History</h1><p>Pick up where you left off. Your conversations are saved locally on this device.</p></div>
        <button className="hero-cta small-cta" onClick={() => onNew("chat")}><span>Start a chat</span><ArrowUpRight size={16} /></button>
      </div>

      <div className="history-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your sessions" aria-label="Search sessions" />
          {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
        </label>
        <span className="history-count">{filtered.length} {filtered.length === 1 ? "session" : "sessions"}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty-panel">
          <div className="empty-orbit"><Clock3 size={19} /></div>
          <strong>{query ? "No matching sessions" : "A clean slate"}</strong>
          <span>{query ? "Try a different search term." : "Your chats, research notes, and tiny apps will appear here."}</span>
          {!query && <button className="text-link" onClick={() => onNew("agent")}>Try an Agent task <ArrowUpRight size={14} /></button>}
        </div>
      ) : (
        <div className="history-table">
          {filtered.map((session) => (
            <div className="history-table-row" key={session.id}>
              <button className={`history-table-icon ${session.mode}`} aria-label={`${modeLabels[session.mode]} session`} onClick={() => onOpen(session)}>
                {session.mode === "agent" ? <Compass size={17} /> : session.mode === "app_builder" ? <Code2 size={17} /> : <MessageSquareText size={17} />}
              </button>
              <button className="history-table-main" onClick={() => onOpen(session)}>
                <strong>{session.title}</strong>
                <span>{modeLabels[session.mode]} <i>·</i> {session.messages.length} {session.messages.length === 1 ? "message" : "messages"}</span>
              </button>
              <span className="history-table-date">{formatDate(session.updatedAt)}</span>
              <button className="history-open" onClick={() => onOpen(session)} aria-label={`Open ${session.title}`}><ArrowUpRight size={17} /></button>
              <button className="history-delete" onClick={() => onDelete(session.id)} aria-label={`Delete ${session.title}`}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="history-note"><span className="note-dot" /> History is stored in your browser or app storage. Clearing app data removes it.</div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
