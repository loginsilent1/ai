import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  Cpu,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import {
  emailRegister,
  emailSignIn,
  ensureGuestSession,
  firebaseIsConfigured,
  observeAuth,
  signOutUser,
} from "../lib/firebase";
import { getApiBaseLabel } from "../lib/api";
import type { HealthStatus } from "../types";

interface SettingsScreenProps {
  health: HealthStatus;
  healthError: string;
  remainingToday: number | null;
  plan: "free" | "pro";
  onRefresh: () => void;
}

export function SettingsScreen({ health, healthError, remainingToday, plan, onRefresh }: SettingsScreenProps) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"sign-in" | "create">("create");
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = observeAuth(setUser);
    if (firebaseIsConfigured) void ensureGuestSession().catch(() => undefined);
    return unsubscribe;
  }, []);

  const providers = health.providers;
  const configuredCount = providers ? Number(providers.groq) + Number(providers.gemini) : 0;
  const dailyLimit = health.daily_limits?.[plan] ?? 30;
  const serverReady = health.status === "ok";

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountBusy(true);
    setAccountError("");
    try {
      if (accountMode === "create") await emailRegister(email.trim(), password);
      else await emailSignIn(email.trim(), password);
      setPassword("");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not update the account.");
    } finally {
      setAccountBusy(false);
    }
  }

  return (
    <div className="simple-page page-scroll settings-page">
      <div className="page-topline">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR SPACE, YOUR RULES</div>
        <button className="refresh-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh status</button>
      </div>
      <div className="simple-page-heading">
        <div><div className="section-kicker">PREFERENCES & TRANSPARENCY</div><h1>Settings</h1><p>See how Argon connects, what stays on your device, and what needs setup.</p></div>
      </div>

      <section className="settings-card connection-card">
        <div className="settings-card-heading">
          <span className={`settings-icon ${serverReady ? "healthy" : "warning"}`}>{serverReady ? <Wifi size={18} /> : <CircleAlert size={18} />}</span>
          <div><span className="section-kicker">CONNECTION</span><h2>AI service</h2></div>
          <span className={`service-pill ${serverReady ? "online" : "offline"}`}><i />{serverReady ? "API reachable" : "Not connected"}</span>
        </div>
        <div className="connection-details">
          <div className="connection-detail"><span>Server</span><strong>{getApiBaseLabel()}</strong></div>
          <div className="connection-detail"><span>Free providers</span><strong>{providers ? `${configuredCount} configured` : "Status unknown"}</strong></div>
          <div className="connection-detail"><span>Authentication</span><strong>{health.auth_mode === "firebase" ? "Verified Firebase session" : health.auth_mode === "dev" ? "Local development only" : "Not reported"}</strong></div>
        </div>
        {healthError ? <div className="inline-warning"><CircleAlert size={15} /><span>{healthError}</span></div> : !configuredCount && !providers?.premium ? (
          <div className="inline-warning"><CircleAlert size={15} /><span>The API is reachable, but no model key is configured. Add a provider key on your server — not in this app.</span></div>
        ) : null}
        <div className="provider-list">
          <div className={`provider-row ${providers?.groq ? "ready" : ""}`}><span className="provider-mark groq-mark">G</span><span><strong>Groq</strong><small>Free route · OpenAI-compatible</small></span><span className="provider-state">{providers?.groq ? <><Check size={13} /> Ready</> : "Not configured"}</span></div>
          <div className={`provider-row ${providers?.gemini ? "ready" : ""}`}><span className="provider-mark gemini-mark">✳</span><span><strong>Gemini</strong><small>Free fallback · Google AI</small></span><span className="provider-state">{providers?.gemini ? <><Check size={13} /> Ready</> : "Not configured"}</span></div>
          <div className={`provider-row ${providers?.premium ? "ready" : ""}`}><span className="provider-mark premium-mark"><Sparkles size={14} /></span><span><strong>Verified Pro route</strong><small>Configured provider · only for server-verified Pro accounts</small></span><span className="provider-state">{providers?.premium ? <><Check size={13} /> Ready</> : "Not configured"}</span></div>
        </div>
      </section>

      <div className="settings-grid">
        <section className="settings-card account-card">
          <div className="settings-card-heading compact-settings-heading">
            <span className="settings-icon account-icon"><LockKeyhole size={17} /></span>
            <div><span className="section-kicker">ACCOUNT</span><h2>{firebaseIsConfigured ? "Keep your access" : "Ready for sign-in"}</h2></div>
          </div>
          {firebaseIsConfigured ? (
            <>
              <p className="settings-description">Sign-in tokens are verified by your server. A guest session works too; creating an account helps keep the same identity across installs.</p>
              {user && !user.isAnonymous ? (
                <div className="signed-in-card"><CircleCheck size={17} /><span><strong>Signed in</strong><small>{user.email || "Account connected"}</small></span><button onClick={() => void signOutUser()}>Switch</button></div>
              ) : (
                <form className="account-form" onSubmit={submitAccount}>
                  <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
                  <label>Password<input type="password" autoComplete={accountMode === "create" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" minLength={6} required /></label>
                  {accountError && <div className="form-error">{accountError}</div>}
                  <button className="settings-primary-button" type="submit" disabled={accountBusy}>{accountBusy ? "Working…" : accountMode === "create" ? "Create account" : "Sign in"}<ArrowUpRight size={15} /></button>
                  <button className="account-toggle" type="button" onClick={() => { setAccountMode(accountMode === "create" ? "sign-in" : "create"); setAccountError(""); }}>
                    {accountMode === "create" ? "Already have an account? Sign in" : "New to Argon? Create an account"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <p className="settings-description">This local preview uses a development device ID. Before a public release, configure Firebase Authentication and switch the server to verified-token mode.</p>
              <div className="setup-chip"><CircleAlert size={14} /> Development authentication only</div>
            </>
          )}
        </section>

        <section className="settings-card plan-card">
          <div className="settings-card-heading compact-settings-heading">
            <span className="settings-icon plan-icon"><Sparkles size={17} /></span>
            <div><span className="section-kicker">USAGE</span><h2>{plan === "pro" ? "Pro workspace" : "Free workspace"}</h2></div>
          </div>
          <p className="settings-description">Usage caps protect your experience and keep provider costs predictable. Your current route is chosen by your verified account, never a client-side switch.</p>
          <div className="usage-meter-wrap">
            <div className="usage-meter-label"><span>{remainingToday === null ? `Daily ${plan} request cap` : "Messages remaining today"}</span><strong>{remainingToday ?? dailyLimit}</strong></div>
            <div className="usage-meter"><span style={{ width: remainingToday === null ? "100%" : `${Math.max(0, Math.min(100, (remainingToday / dailyLimit) * 100))}%` }} /></div>
            <small>Daily limits reset at 00:00 UTC. Pro routing is enabled only after a trusted billing entitlement is connected.</small>
          </div>
        </section>
      </div>

      <section className="settings-card store-card">
        <div className="store-icon"><Cpu size={19} /></div>
        <div className="store-copy"><span className="section-kicker">PLAY STORE CHECKLIST</span><h2>Billing is intentionally not switched on yet</h2><p>Before selling digital Pro features in the Android release, add Google Play Billing and verify purchase tokens on the server. Never unlock Pro from a button or a request field.</p></div>
        <span className="store-status">SETUP REQUIRED</span>
      </section>

      <div className="settings-grid privacy-grid">
        <section className="settings-card privacy-card">
          <div className="settings-card-heading compact-settings-heading">
            <span className="settings-icon privacy-icon"><ShieldCheck size={17} /></span>
            <div><span className="section-kicker">PRIVACY</span><h2>What stays here</h2></div>
          </div>
          <ul className="privacy-list">
            <li><Check size={14} /><span>Chat history is stored locally on this device.</span></li>
            <li><Check size={14} /><span>Prompts go to the configured AI provider; Agent search queries also go to the web-search service.</span></li>
            <li><Check size={14} /><span>PDF text is extracted in memory and not written to disk.</span></li>
            <li><Check size={14} /><span>Provider keys never ship in the mobile bundle.</span></li>
          </ul>
        </section>
        <section className="settings-card docs-card">
          <div className="settings-card-heading compact-settings-heading">
            <span className="settings-icon docs-icon"><FileText size={17} /></span>
            <div><span className="section-kicker">GOOD TO KNOW</span><h2>Before you ship</h2></div>
          </div>
          <p className="settings-description">Add your own privacy policy, support contact, API domain, account deletion flow, and Play Store billing verification before publishing.</p>
          <div className="docs-footer"><span>Play Store-ready foundation, not a finished listing</span><ArrowUpRight size={15} /></div>
        </section>
      </div>

      <div className="settings-footer-note"><LockKeyhole size={13} /> Never paste API keys into the app or chat. Configure them only as server environment variables.</div>
    </div>
  );
}
