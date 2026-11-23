import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Code2,
  Compass,
  Copy,
  FileText,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateReply } from "../lib/api";
import { createMessageId } from "../lib/storage";
import { looksLikeHtml } from "../lib/preview";
import type { ChatMessage, ChatSession, Mode, SearchSource } from "../types";
import { AppPreview, PreviewModal } from "../components/AppPreview";

interface ChatScreenProps {
  session: ChatSession;
  initialPrompt?: string;
  currentPlan: "free" | "pro";
  onSessionChange: (session: ChatSession) => void;
  onModeChange: (mode: Mode) => void;
  onUsage: (plan: "free" | "pro", remaining: number) => void;
  onBack: () => void;
  onOpenSettings: () => void;
}

const modeInfo: Record<Mode, { label: string; icon: typeof MessageSquareText; note: string }> = {
  chat: { label: "Chat", icon: MessageSquareText, note: "Fast, friendly help for everyday things." },
  agent: { label: "Agent", icon: Compass, note: "Live web research and private PDF analysis." },
  app_builder: { label: "App Studio", icon: Code2, note: "Build an interactive mini-app and preview it live." },
};

function stripHtmlFence(value: string): string {
  const match = value.trim().match(/^```(?:html|HTML)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : value.trim();
}

function appReply(session: ChatSession): string | null {
  const found = [...session.messages].reverse().find(
    (message) => message.role === "assistant" && message.mode === "app_builder" && looksLikeHtml(message.content),
  );
  return found ? stripHtmlFence(found.content) : null;
}

export function ChatScreen({
  session,
  initialPrompt = "",
  currentPlan,
  onSessionChange,
  onModeChange,
  onUsage,
  onBack,
  onOpenSettings,
}: ChatScreenProps) {
  const [draft, setDraft] = useState(initialPrompt);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => appReply(session), [session]);
  const mode = session.mode;
  const ModeIcon = modeInfo[mode].icon;

  useEffect(() => {
    setDraft(initialPrompt);
    setSelectedFile(null);
  }, [session.id, initialPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.messages.length, loading]);

  function resizeDraft() {
    const element = draftRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 148)}px`;
  }

  function changeMode(nextMode: Mode) {
    if (loading) return;
    setModeMenuOpen(false);
    if (nextMode === mode) return;
    setSelectedFile(null);
    setAttachmentError("");
    onModeChange(nextMode);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = draft.trim();
    if (!prompt || loading) return;

    const modeAtSend = session.mode;
    const previousHistory = session.messages
      .filter((message) => !message.isError)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 8_000) }));
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: selectedFile ? `${prompt}\n\n📎 ${selectedFile.name}` : prompt,
      mode: modeAtSend,
      createdAt: Date.now(),
    };
    const pending: ChatSession = {
      ...session,
      title: session.messages.length === 0 ? prompt.split("\n")[0].slice(0, 64) || "New task" : session.title,
      updatedAt: Date.now(),
      messages: [...session.messages, userMessage],
    };
    onSessionChange(pending);
    setDraft("");
    setSelectedFile(null);
    setAttachmentError("");
    setLoading(true);
    requestAnimationFrame(resizeDraft);

    try {
      const result = await generateReply({
        prompt,
        mode: modeAtSend,
        history: previousHistory,
        file: selectedFile,
      });
      const reply = modeAtSend === "app_builder" ? stripHtmlFence(result.reply) : result.reply;
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: reply,
        mode: modeAtSend,
        createdAt: Date.now(),
        provider: result.provider_used,
        plan: result.plan,
        remainingToday: result.remaining_today,
        sources: result.sources,
      };
      onUsage(result.plan, result.remaining_today);
      onSessionChange({
        ...pending,
        updatedAt: Date.now(),
        messages: [...pending.messages, assistantMessage],
      });
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        mode: modeAtSend,
        createdAt: Date.now(),
        isError: true,
      };
      onSessionChange({
        ...pending,
        updatedAt: Date.now(),
        messages: [...pending.messages, assistantMessage],
      });
    } finally {
      setLoading(false);
      requestAnimationFrame(resizeDraft);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId((current) => current === message.id ? null : current), 1600);
    } catch {
      setCopiedId(null);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(null);
      setAttachmentError("Choose a PDF file to use Agent document analysis.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSelectedFile(null);
      setAttachmentError("This PDF is larger than 8 MB. Choose a smaller file.");
      return;
    }
    setAttachmentError("");
    setSelectedFile(file);
  }

  const modeTitle = modeInfo[mode].label;
  const hasMessages = session.messages.length > 0;

  return (
    <div className={`chat-page ${mode === "app_builder" ? "studio-chat-page" : ""}`}>
      <header className="chat-header">
        <button className="chat-back-button" onClick={onBack} aria-label="Back to overview"><ArrowLeft size={18} /></button>
        <div className="chat-title-wrap">
          <div className={`chat-mode-symbol ${mode}`}><ModeIcon size={16} /></div>
          <div className="chat-title-copy"><strong>{modeTitle}</strong><span>{session.title || "New task"}</span></div>
        </div>
        <div className="chat-header-right">
          <span className="route-pill"><span /> {currentPlan === "pro" ? "Verified Pro route" : "Free route"}</span>
          {mode === "app_builder" && html && <button className="preview-open-button" onClick={() => setPreviewExpanded(true)}><Sparkles size={14} /> Preview app</button>}
          <div className="mode-selector-wrap">
            <button className={`mode-selector-button ${modeMenuOpen ? "open" : ""}`} onClick={() => setModeMenuOpen((open) => !open)} disabled={loading} aria-expanded={modeMenuOpen}>
              <span>Mode</span><ChevronDown size={14} />
            </button>
            {modeMenuOpen && <div className="mode-menu">
              {(Object.keys(modeInfo) as Mode[]).map((item) => {
                const Icon = modeInfo[item].icon;
                return <button key={item} className={item === mode ? "selected" : ""} onClick={() => changeMode(item)}><Icon size={15} /><span>{modeInfo[item].label}</span>{item === mode && <Check size={14} />}</button>;
              })}
            </div>}
          </div>
        </div>
      </header>

      <div className={`chat-workspace ${mode === "app_builder" && html ? "has-preview" : ""}`}>
        <div className="chat-conversation-column">
          <div className="mode-context-line"><span className="mode-context-icon"><ModeIcon size={13} /></span>{modeInfo[mode].note}<span className="context-lock"><LockKeyhole size={11} /> Private by default</span></div>
          <div className={`messages-scroll ${!hasMessages ? "empty-messages" : ""}`}>
            {!hasMessages ? (
              <div className={`chat-welcome ${mode}`}>
                <div className="chat-welcome-orb"><ModeIcon size={22} /></div>
                <div className="chat-welcome-eyebrow">{mode === "app_builder" ? "ARGON APP STUDIO" : mode === "agent" ? "ARGON AGENT" : "ARGON CHAT"}</div>
                <h1>{mode === "app_builder" ? <>A useful idea, <span>made real.</span></> : mode === "agent" ? <>Let's <span>find the signal.</span></> : <>A fresh start.<br /><span>What's on your mind?</span></>}</h1>
                <p>{mode === "app_builder" ? "Describe a tool or tiny app. We'll build a runnable, touch-friendly preview." : mode === "agent" ? "Ask for a researched answer, upload a PDF, or turn a big task into a clear plan." : "Ask anything, draft a note, translate a thought, or learn something new."}</p>
                <div className="starter-grid">
                  {(mode === "app_builder"
                    ? ["Build a Nepali Rupee EMI calculator", "Make a clean todo app", "Create a study timer with breaks"]
                    : mode === "agent"
                      ? ["Research student visa steps for Nepal", "Summarize an uploaded PDF", "Plan a one-week study schedule"]
                      : ["Write a polite Nibedan in Nepali", "Explain photosynthesis simply", "Translate this into natural English"]
                  ).map((idea) => <button key={idea} className="starter-chip" onClick={() => setDraft(idea)}>{idea}<ArrowUp size={12} className="starter-arrow" /></button>)}
                </div>
              </div>
            ) : (
              <div className="message-list">
                {session.messages.map((message) => (
                  <MessageItem key={message.id} message={message} onCopy={() => void copyMessage(message)} copied={copiedId === message.id} onOpenSettings={onOpenSettings} onPreview={() => setPreviewExpanded(true)} />
                ))}
                {loading && <div className="assistant-row typing-row"><div className="assistant-avatar"><Sparkles size={14} /></div><div className="typing-bubble"><span /><span /><span /><em>Thinking…</em></div></div>}
                <div ref={bottomRef} className="scroll-anchor" />
              </div>
            )}
          </div>
          {mode === "app_builder" && html && <button className="mobile-canvas-link" onClick={() => setPreviewExpanded(true)}><Sparkles size={14} /> Open live preview <ArrowUp size={13} /></button>}
          <form className="composer-form" onSubmit={(event) => void submit(event)}>
            {attachmentError && <div className="attachment-error">{attachmentError}</div>}
            {selectedFile && <div className="attachment-chip"><FileText size={13} /><span>{selectedFile.name}</span><button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove PDF"><X size={13} /></button></div>}
            <div className="composer-box">
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(event) => { setDraft(event.target.value); resizeDraft(); }}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={8000}
                placeholder={mode === "app_builder" ? "Describe the app you want to make…" : mode === "agent" ? "What should I research or help you work through?" : "Message Argon…"}
                aria-label="Message Argon"
                disabled={loading}
              />
              <div className="composer-actions">
                <div className="composer-tools">
                  {mode === "agent" && <>
                    <input ref={fileInputRef} className="hidden-file-input" type="file" accept="application/pdf,.pdf" onChange={handleFile} />
                    <button className={`composer-tool ${selectedFile ? "selected" : ""}`} type="button" onClick={() => fileInputRef.current?.click()} disabled={loading} aria-label="Attach PDF"><Paperclip size={16} /><span>PDF</span></button>
                    <span className="composer-helper">Up to 8 MB · up to 40 pages</span>
                  </>}
                  {mode === "app_builder" && <span className="composer-helper studio-helper"><LockKeyhole size={11} /> App runs in an isolated sandbox</span>}
                  {mode === "chat" && <span className="composer-helper">English · नेपाली · Romanized Nepali</span>}
                </div>
                <div className="composer-send-group">
                  <span className="character-count">{draft.length > 0 ? `${draft.length}/8000` : ""}</span>
                  <button className="send-button" type="submit" disabled={loading || !draft.trim()} aria-label={loading ? "Generating response" : "Send message"}>
                    {loading ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={18} strokeWidth={2.3} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="composer-disclaimer">Argon can make mistakes. Verify important details before you act.</div>
          </form>
        </div>

        {mode === "app_builder" && <AppPreview html={html} onExpand={() => setPreviewExpanded(true)} />}
      </div>

      {previewExpanded && html && <PreviewModal html={html} onClose={() => setPreviewExpanded(false)} />}
    </div>
  );
}

function MessageItem({
  message,
  onCopy,
  copied,
  onOpenSettings,
  onPreview,
}: {
  message: ChatMessage;
  onCopy: () => void;
  copied: boolean;
  onOpenSettings: () => void;
  onPreview: () => void;
}) {
  const isUser = message.role === "user";
  const isApp = !isUser && message.mode === "app_builder" && looksLikeHtml(message.content);
  const html = isApp ? stripHtmlFence(message.content) : "";
  return (
    <article className={`message-row ${isUser ? "user-row" : "assistant-row"} ${message.isError ? "error-row" : ""}`}>
      {!isUser && <div className={`assistant-avatar ${message.isError ? "error-avatar" : ""}`}>{message.isError ? <X size={14} /> : <Sparkles size={14} />}</div>}
      <div className={`message-content ${isUser ? "user-message-content" : "assistant-message-content"}`}>
        {!isUser && <div className="message-speaker">{message.isError ? "Couldn't complete that" : "Argon"}{message.provider && <span>{message.provider}</span>}</div>}
        <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
          {isApp ? (
            <div className="generated-code-card">
              <div className="generated-code-top"><span><Code2 size={14} /> Runnable HTML app</span><span className="code-status"><span /> Ready to preview</span></div>
              <p>Built as a single file. Open the isolated preview to try it, then ask for changes here.</p>
              <div className="generated-code-actions"><button onClick={onPreview}><Sparkles size={14} /> Open live preview</button><span>{html.length.toLocaleString()} characters</span></div>
              <details className="source-details"><summary>View generated source</summary><pre><code>{html}</code></pre></details>
            </div>
          ) : message.isError ? (
            <div className="error-message-copy"><span>{message.content}</span><button onClick={onOpenSettings}>Check setup</button></div>
          ) : isUser ? (
            <div className="plain-user-text">{message.content}</div>
          ) : (
            <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
          )}
        </div>
        {!isUser && !message.isError && <>
          {message.sources?.length ? <SourceList sources={message.sources} /> : null}
          <div className="message-actions">
            <button onClick={onCopy} aria-label="Copy response">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button>
            {typeof message.remainingToday === "number" && <span>{message.remainingToday} left today</span>}
          </div>
        </>}
      </div>
    </article>
  );
}

function SourceList({ sources }: { sources: SearchSource[] }) {
  return (
    <details className="source-list">
      <summary><Compass size={13} /> {sources.length} web sources <ChevronDown size={13} /></summary>
      <div className="source-items">
        {sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
          <strong>{source.title}</strong><span>{source.snippet}</span><i>{sourceHostname(source.url)}</i>
        </a>)}
      </div>
    </details>
  );
}

function sourceHostname(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.hostname : "Source";
  } catch {
    return "Source";
  }
}
