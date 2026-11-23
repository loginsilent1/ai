import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Compass,
  Cpu,
  FileText,
  Globe2,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ChatSession, HealthStatus, Mode } from "../types";

interface HomeScreenProps {
  sessions: ChatSession[];
  health: HealthStatus;
  remainingToday: number | null;
  onStart: (mode: Mode, prompt?: string) => void;
  onOpenSession: (session: ChatSession) => void;
}

const modes: Array<{
  mode: Mode;
  icon: typeof MessageSquareText;
  title: string;
  subtitle: string;
  detail: string;
  className: string;
}> = [
  {
    mode: "chat",
    icon: MessageSquareText,
    title: "Chat",
    subtitle: "Think out loud",
    detail: "Everyday help, writing, translation, and learning.",
    className: "mode-chat",
  },
  {
    mode: "agent",
    icon: Compass,
    title: "Agent",
    subtitle: "Go a little deeper",
    detail: "Web research and PDF notes, organized into clear next steps.",
    className: "mode-agent",
  },
  {
    mode: "app_builder",
    icon: Code2,
    title: "App Studio",
    subtitle: "Make it interactive",
    detail: "Describe a small tool. Preview a working app right here.",
    className: "mode-studio",
  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function providerSummary(health: HealthStatus): string {
  const providers = health.providers;
  if (!providers) return "Connect your server to get started";
  const active = [providers.groq && "Groq", providers.gemini && "Gemini", providers.premium && "Pro route"].filter(Boolean);
  return active.length ? `${active.join(" + ")} ready` : "Add an AI provider key to your server";
}

export function HomeScreen({ sessions, health, remainingToday, onStart, onOpenSession }: HomeScreenProps) {
  const latest = sessions.slice(0, 3);
  const quickPrompts: Array<{ icon: typeof Sparkles; mode: Mode; text: string; label: string }> = [
    { icon: Sparkles, mode: "chat", label: "Write better", text: "Help me write a clear, respectful Nibedan in Nepali." },
    { icon: Globe2, mode: "agent", label: "Research", text: "Research scholarships for Nepali students and make a source-linked checklist." },
    { icon: Zap, mode: "app_builder", label: "Build a tool", text: "Build a simple monthly budget tracker using NPR." },
  ];

  return (
    <div className="home-page page-scroll">
      <div className="page-topline">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL WORKSPACE</div>
        <div className="date-stamp">A little clarity goes a long way.</div>
      </div>

      <section className="welcome-hero">
        <div className="welcome-copy">
          <div className="hero-kicker"><Sparkles size={13} /> BUILT FOR YOUR NEXT IDEA</div>
          <h1>{greeting()}<br /><span>What can we make easier?</span></h1>
          <p>One calm place to ask, research, and build — in English, नेपाली, or the way you speak every day.</p>
          <button className="hero-cta" onClick={() => onStart("chat")}>
            Start a conversation <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-art-core"><Sparkles size={36} strokeWidth={1.25} /></div>
          <div className="hero-art-node node-a"><MessageSquareText size={15} /></div>
          <div className="hero-art-node node-b"><Globe2 size={15} /></div>
          <div className="hero-art-node node-c"><Code2 size={15} /></div>
          <div className="hero-orbit-label label-a">ASK</div>
          <div className="hero-orbit-label label-b">BUILD</div>
        </div>
        <div className="hero-bottomline">
          <span><ShieldCheck size={14} /> Your API keys stay on your server</span>
          <span className="hero-stat"><span className="status-light" /> {providerSummary(health)}</span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <div className="section-kicker">CHOOSE YOUR FLOW</div>
            <h2>Three ways to get there</h2>
          </div>
          {remainingToday !== null && <div className="quota-badge"><Zap size={13} /> {remainingToday} messages left today</div>}
        </div>
        <div className="mode-grid">
          {modes.map(({ mode, icon: Icon, title, subtitle, detail, className }) => (
            <button key={mode} className={`mode-card ${className}`} onClick={() => onStart(mode)}>
              <div className="mode-card-top">
                <div className="mode-icon"><Icon size={19} strokeWidth={1.8} /></div>
                <ArrowUpRight size={17} className="mode-card-arrow" />
              </div>
              <span className="mode-subtitle">{subtitle}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
              <div className="mode-card-foot">
                <span>{mode === "chat" ? "FAST · EVERYDAY" : mode === "agent" ? "SEARCH · DOCUMENTS" : "CODE · LIVE PREVIEW"}</span>
                <span className="mode-foot-line" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="home-lower-grid">
        <section className="section-block quickstart-block">
          <div className="section-heading compact-heading">
            <div>
              <div className="section-kicker">A GOOD PLACE TO START</div>
              <h2>Pick up a thread</h2>
            </div>
            <span className="muted-count">3 ideas</span>
          </div>
          <div className="prompt-list">
            {quickPrompts.map(({ icon: Icon, mode, text, label }) => (
              <button className="prompt-row" key={label} onClick={() => onStart(mode, text)}>
                <span className={`prompt-icon ${mode}`}><Icon size={16} /></span>
                <span className="prompt-copy"><strong>{label}</strong><span>{text}</span></span>
                <ChevronRight size={16} className="prompt-chevron" />
              </button>
            ))}
          </div>
        </section>

        <section className="section-block recent-block">
          <div className="section-heading compact-heading">
            <div>
              <div className="section-kicker">YOUR WORK</div>
              <h2>Recent sessions</h2>
            </div>
            <button className="text-link" onClick={() => onStart("chat")}>
              New <PlusIcon />
            </button>
          </div>
          {latest.length ? (
            <div className="recent-list">
              {latest.map((session) => (
                <button key={session.id} className="recent-row" onClick={() => onOpenSession(session)}>
                  <span className={`recent-mode-icon ${session.mode}`}>
                    {session.mode === "agent" ? <Compass size={15} /> : session.mode === "app_builder" ? <Code2 size={15} /> : <MessageSquareText size={15} />}
                  </span>
                  <span className="recent-copy"><strong>{session.title}</strong><span>{session.messages.length} {session.messages.length === 1 ? "message" : "messages"}</span></span>
                  <span className="recent-time">{relativeTime(session.updatedAt)}</span>
                  <ChevronRight size={15} className="recent-arrow" />
                </button>
              ))}
            </div>
          ) : (
            <div className="recent-empty">
              <div className="empty-orbit"><MessageSquareText size={19} /></div>
              <strong>Your sessions live here</strong>
              <span>Start a chat, research task, or build to see your work saved on this device.</span>
            </div>
          )}
        </section>
      </div>

      <section className="trust-strip">
        <div className="trust-copy">
          <span className="trust-icon"><ShieldCheck size={17} /></span>
          <div><strong>Small by design. Thoughtful by default.</strong><span>Conversation history stays on this device. Prompts go to the server you configure.</span></div>
        </div>
        <div className="trust-points">
          <span><Check size={13} /> No keys in the app</span>
          <span><FileText size={13} /> PDFs not stored</span>
          <span><Cpu size={13} /> Clear model routing</span>
        </div>
      </section>
    </div>
  );
}

function PlusIcon() {
  return <Plus size={14} />;
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
