# Argon Pocket

An Android-first AI workspace for everyday chat, web research, PDF notes, and tiny runnable apps. The interface takes cues from Argon Omega's tool-focused workspace, but is designed from scratch for a phone: a compact dashboard, bottom navigation, touch-sized controls, and a private App Studio preview. It is not an Arena.ai clone or affiliated with Arena.ai.

## What is included

- **Chat** — English, नेपाली, and Romanized Nepali prompts, local conversation history, and readable Markdown responses.
- **Agent** — optional live web search, source cards, text extraction from a PDF (up to 8 MB / 40 pages by default), and a bounded local arithmetic evaluator for simple calculations. Uploaded PDF bytes/text are not written to disk by this API.
- **App Studio** — requests a standalone HTML/CSS/JS app and runs it in an origin-isolated sandboxed iframe. A restrictive CSP blocks common fetch/XHR/socket, external asset, form, and nested-frame requests; the preview gets no app bridge, files, or account data.
- **Smart routing** — free accounts try the configured Groq/Gemini providers in order; a verified Pro account can use a separately configured OpenAI-compatible premium endpoint. Provider keys stay on the server.
- **Play Store foundation** — responsive Capacitor Android client, optional Firebase Authentication, API quotas, and a Play Store release checklist.

This is a **starter implementation**, not a claim of zero operating cost or a finished Play Store listing. Free tiers, model IDs, quotas, and provider terms can change; monitor usage and set provider-side spending limits.

## Repository layout

```text
app/                  React + TypeScript + Capacitor client
server/argon_api/      FastAPI router, Firebase token verification, PDF/search tools
server/tests/          API and quota tests
.env.example           Server configuration template
```

## Run locally

Use Python 3.11+ and Node.js 22+. Android packaging additionally needs Android Studio, the Android SDK, and a compatible JDK.

### 1. Start the API

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r server/requirements.txt
```

Add at least one provider key to `.env` on the server only:

```dotenv
GROQ_API_KEY=your-server-side-key
# or
GEMINI_API_KEY=your-server-side-key
```

Then start FastAPI from the repository root:

```bash
uvicorn argon_api.main:app --app-dir server --env-file .env --reload --host 0.0.0.0 --port 8000
```

The local-only `AUTH_MODE=dev` accepts a generated device ID and always assigns the Free plan. It is for development, not a production authentication or anti-abuse mechanism. API health is available at `http://127.0.0.1:8000/api/health`.

### 2. Start the client

In another terminal:

```bash
cd app
cp .env.example .env       # optional; blank VITE_API_BASE_URL uses the Vite /api proxy
npm ci
npm run dev
```

Open the Vite URL. In development, `/api` is proxied to FastAPI on port 8000. Do not put Groq, Gemini, or premium API keys in `app/.env`.

### 3. Test

From the repository root:

```bash
pytest -q
npm --prefix app run build
```

## Provider routing and authentication

- `FREE_PROVIDER_ORDER=groq,gemini` configures free-tier fallback order. Only providers with server-side keys are attempted. The sample model IDs are configuration defaults; check each provider's current model catalog before deploying because IDs and free quotas can change.
- `PREMIUM_API_BASE_URL`, `PREMIUM_API_KEY`, and `PREMIUM_MODEL` are intentionally blank in the sample. Fill them only with the compatible URL/model documented by the provider you actually use; this project does **not** assume an Arena endpoint.
- The client never sends an `is_paid_user` flag. In production, set `APP_ENV=production`, `AUTH_MODE=firebase`, and `FIREBASE_PROJECT_ID`; the API verifies Firebase ID tokens. A trusted, server-issued Firebase custom claim `plan=pro` selects the premium route. Users cannot grant themselves Pro from the app.
- The repository does not yet implement purchase checkout or purchase-token verification. Before selling Pro on Android, integrate **Google Play Billing** and verify purchases on the server before issuing an entitlement. Do not unlock subscriptions from a client flag. Follow current Play policies for your region and product; do not assume external eSewa/Khalti checkout is allowed for digital features in a Play-distributed app.
- AdMob is not wired in this starter. Add ad-unit IDs, consent/age flows, and the required privacy disclosures only after setting up the AdMob account and reviewing the current Play policies.
- The included SQLite quota store is suitable for a single small deployment. Use a shared database/Redis-backed limiter and persistent encrypted storage for a horizontally scaled production service.

### Firebase setup for production

1. Create a Firebase project, enable Anonymous and Email/Password sign-in, and add Android package `com.loginsilent1.argonpocket`.
2. Build the app with the public Firebase client config values in `app/.env` (`VITE_FIREBASE_*`). These are client identifiers, not provider secrets.
3. Configure the API with `APP_ENV=production`, `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, and Application Default Credentials or a service-account file mounted outside this repository (`FIREBASE_CREDENTIALS_FILE`). Never commit that credential file.
4. Set `APP_ALLOWED_ORIGINS` to your deployed web origin plus the Capacitor origin if required. Use HTTPS for every public API/provider endpoint.
5. Connect your verified Play Billing workflow to server-side entitlement management before setting the trusted `plan=pro` claim.

## Build the Android app for Play Store testing

This client uses Capacitor so the same phone-first interface can be tested in a browser and packaged as an Android app. Install Android Studio, Android SDK, and a compatible JDK, then:

```bash
cd app
npm ci
# Release builds need the public HTTPS backend URL at compile time:
VITE_API_BASE_URL=https://api.example.com npm run build
npx cap sync android
npx cap open android
```

The native `android/` Gradle project is included. If you later regenerate it, run `npx cap add android` only when the `android/` directory is absent.

Use Android Studio to set a release signing key and build a signed **Android App Bundle (AAB)**. Keep signing credentials out of Git. Before submitting, set production Firebase/API configuration, add app icons/screenshots, test on real Android devices and small screens, publish a privacy policy and support contact, provide account/data deletion where applicable, and complete the Play Console data-safety declarations. The Pro purchase screen is deliberately not enabled until server-side Google Play Billing verification exists.

## Safety and privacy notes

- The App Studio iframe uses `sandbox="allow-scripts"` without `allow-same-origin`, plus a restrictive Content Security Policy for app requests, external assets, forms, and frames. Treat generated apps as untrusted code; do not put secrets into a preview, and test any change to the sandbox policy carefully.
- Agent search results and PDF text are marked as untrusted context. Search snippets can be incomplete; scanned-image PDFs need OCR and are not handled by this starter.
- Prompts and attached PDF excerpts are forwarded to the configured model provider; Agent-mode search queries are also sent to the configured web-search service. Conversation history is stored locally in browser/app storage; it is not a server-side account sync feature.
- The example daily limits are request-count caps, not a guarantee of zero cost. Add monitoring, provider-side budgets, abuse controls/App Check, retention rules, and a privacy policy before a public launch.
