import {
  ArrowUpRight,
  Code2,
  History,
  Home,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { ChatSession, Page } from "../types";

interface NavigationProps {
  page: Page;
  sessions: ChatSession[];
  onNavigate: (page: Page) => void;
  onNewChat: () => void;
  onOpenSession: (session: ChatSession) => void;
  plan: "free" | "pro";
}

const links = [
  { id: "home" as const, label: "Overview", icon: Home },
  { id: "history" as const, label: "History", icon: History },
  { id: "studio" as const, label: "App Studio", icon: Code2 },
];

function Brand() {
  return (
    <div className="brand-lockup">
      <span className="brand-mark"><Sparkles size={17} strokeWidth={2.2} /></span>
      <span className="brand-name">argon<span>pocket</span></span>
      <span className="brand-version">BETA</span>
    </div>
  );
}

export function Sidebar({ page, sessions, onNavigate, onNewChat, onOpenSession, plan }: NavigationProps) {
  const recent = sessions.slice(0, 5);
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Brand />
        <button className="new-chat-button" onClick={onNewChat}>
          <Plus size={17} /> <span>New task</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => id === "studio" ? onNavigate("studio") : onNavigate(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "studio" && <span className="nav-new-dot" aria-label="New" />}
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span className="nav-caption">RECENT</span>
          <button aria-label="View all history" onClick={() => onNavigate("history")}><ArrowUpRight size={14} /></button>
        </div>
        <div className="sidebar-history">
          {recent.length === 0 ? (
            <div className="history-empty-small">Your sessions will show up here.</div>
          ) : recent.map((session) => (
            <button
              className="history-link"
              key={session.id}
              onClick={() => onOpenSession(session)}
              title={session.title}
            >
              <span className={`history-mode-mark ${session.mode}`} />
              <span>{session.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sidebar-bottom">
        <div className="side-plan-card">
          <div className="side-plan-icon"><Sparkles size={14} /></div>
          <div className="side-plan-copy">
            <strong>{plan === "pro" ? "Pro workspace" : "Free workspace"}</strong>
            <span>{plan === "pro" ? "Verified premium route" : "Thoughtful tools, one place"}</span>
          </div>
          <span className="plan-status-dot" />
        </div>
        <button
          className={`nav-item settings-link ${page === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          aria-current={page === "settings" ? "page" : undefined}
        >
          <Settings2 size={18} strokeWidth={1.8} />
          <span>Settings & privacy</span>
        </button>
        <div className="sidebar-footnote">Made for the way you work.</div>
      </div>
    </aside>
  );
}

interface MobileNavProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export function MobileNav({ page, onNavigate }: MobileNavProps) {
  const current = page === "chat" ? "home" : page;
  return (
    <nav className="mobile-nav" aria-label="Bottom navigation">
      {[
        { id: "home" as const, label: "Home", icon: Home },
        { id: "history" as const, label: "History", icon: History },
        { id: "studio" as const, label: "Studio", icon: Code2 },
        { id: "settings" as const, label: "Settings", icon: Settings2 },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`mobile-nav-item ${current === id ? "active" : ""}`}
          onClick={() => onNavigate(id)}
          aria-current={current === id ? "page" : undefined}
        >
          <Icon size={19} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function MobileBrand() {
  return (
    <div className="mobile-brand">
      <span className="brand-mark"><Sparkles size={16} strokeWidth={2.2} /></span>
      <span className="brand-name">argon<span>pocket</span></span>
    </div>
  );
}
