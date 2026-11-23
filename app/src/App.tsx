import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleDashed } from "lucide-react";
import { ChatScreen } from "./screens/ChatScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";

const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then((module) => ({ default: module.SettingsScreen })));
import { MobileBrand, MobileNav, Sidebar } from "./components/Navigation";
import { fetchAccount, fetchHealth } from "./lib/api";
import { createSession, loadSessions, saveSessions } from "./lib/storage";
import type { ChatSession, HealthStatus, Mode, Page } from "./types";
import "./styles.css";

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [health, setHealth] = useState<HealthStatus>({ status: "unavailable" });
  const [healthError, setHealthError] = useState("");
  const [initialPrompt, setInitialPrompt] = useState("");
  const [usage, setUsage] = useState<{ plan: "free" | "pro"; remaining: number } | null>(null);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const refreshHealth = useCallback(async () => {
    try {
      const response = await fetchHealth();
      setHealth(response);
      setHealthError("");
    } catch (error) {
      setHealth({ status: "unavailable" });
      setHealthError(error instanceof Error ? error.message : "Could not reach the AI server.");
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    let mounted = true;
    void fetchAccount()
      .then((account) => {
        if (mounted) setUsage({ plan: account.plan, remaining: account.remaining_today });
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        const composer = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Argon"]');
        if (composer && (page === "chat" || page === "studio")) composer.focus({ preventScroll: true });
        else startNewChat("chat");
      } else if (event.shiftKey && key === "o") {
        event.preventDefault();
        startNewChat("chat");
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [page]);

  const currentPlan = useMemo(() => {
    if (usage) return usage.plan;
    const recent = [...(activeSession?.messages ?? [])].reverse().find((message) => message.plan);
    return recent?.plan ?? "free";
  }, [usage, activeSession]);

  const remainingToday = useMemo(() => {
    if (usage) return usage.remaining;
    const recent = [...(activeSession?.messages ?? [])].reverse().find((message) => typeof message.remainingToday === "number");
    return recent?.remainingToday ?? null;
  }, [usage, activeSession]);

  function startNewChat(mode: Mode = "chat", prompt = "") {
    const session = createSession(mode);
    setActiveSession(session);
    setInitialPrompt(prompt);
    setPage(mode === "app_builder" ? "studio" : "chat");
  }

  function saveActiveSession(next: ChatSession) {
    setActiveSession(next);
    if (!next.messages.length) return;
    setSessions((previous) => [next, ...previous.filter((item) => item.id !== next.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12));
  }

  function openSession(session: ChatSession) {
    setActiveSession(session);
    setInitialPrompt("");
    setPage(session.mode === "app_builder" ? "studio" : "chat");
  }

  function changeMode(mode: Mode) {
    if (!activeSession) {
      startNewChat(mode);
      return;
    }
    const updated = { ...activeSession, mode, updatedAt: Date.now() };
    saveActiveSession(updated);
    setInitialPrompt("");
    setPage(mode === "app_builder" ? "studio" : "chat");
  }

  function navigate(nextPage: Page) {
    if (nextPage === "studio") {
      if (activeSession?.mode === "app_builder") setPage("studio");
      else startNewChat("app_builder");
      return;
    }
    setPage(nextPage);
  }

  function deleteSession(sessionId: string) {
    setSessions((previous) => previous.filter((session) => session.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setPage("history");
    }
  }

  const showMobileHeader = page !== "chat" && page !== "studio";
  const activeProviders = health.providers
    ? Number(health.providers.groq) + Number(health.providers.gemini) + Number(health.providers.premium)
    : 0;
  const serviceOnline = health.status === "ok" && activeProviders > 0;

  return (
    <div className="app-root">
      <Sidebar
        page={page}
        sessions={sessions}
        onNavigate={navigate}
        onNewChat={() => startNewChat("chat")}
        onOpenSession={openSession}
        plan={currentPlan}
      />
      <div className={`main-shell ${page === "chat" || page === "studio" ? "chat-active" : ""}`}>
        {showMobileHeader && (
          <header className="mobile-topbar">
            <MobileBrand />
            <div className={`mobile-service-state ${serviceOnline ? "online" : ""}`}>
              {serviceOnline ? <CircleCheck size={13} /> : <CircleDashed size={13} />}
              <span>{serviceOnline ? "Connected" : "Setup needed"}</span>
            </div>
          </header>
        )}
        <main className={`main-content ${page === "chat" || page === "studio" ? "conversation-main" : ""}`}>
          {page === "home" && <HomeScreen
            sessions={sessions}
            health={health}
            remainingToday={remainingToday}
            onStart={startNewChat}
            onOpenSession={openSession}
          />}
          {page === "history" && <HistoryScreen
            sessions={sessions}
            onOpen={openSession}
            onNew={(mode) => startNewChat(mode)}
            onDelete={deleteSession}
          />}
          {page === "settings" && <Suspense fallback={<div className="empty-route-fallback">Opening settings…</div>}><SettingsScreen
            health={health}
            healthError={healthError}
            remainingToday={remainingToday}
            plan={currentPlan}
            onRefresh={() => void refreshHealth()}
          /></Suspense>}
          {(page === "chat" || page === "studio") && activeSession && <ChatScreen
            key={activeSession.id}
            session={activeSession}
            initialPrompt={initialPrompt}
            currentPlan={currentPlan}
            onSessionChange={saveActiveSession}
            onModeChange={changeMode}
            onUsage={(plan, remaining) => setUsage({ plan, remaining })}
            onBack={() => setPage("home")}
            onOpenSettings={() => setPage("settings")}
          />}
          {(page === "chat" || page === "studio") && !activeSession && (
            <div className="empty-route-fallback"><CircleDashed size={23} /><span>Starting a fresh workspace…</span><button onClick={() => startNewChat(page === "studio" ? "app_builder" : "chat")}>Continue</button></div>
          )}
        </main>
        {page !== "chat" && page !== "studio" && <MobileNav page={page} onNavigate={navigate} />}
      </div>
    </div>
  );
}
