# AI-Powered Collaborative Rich Text Editor

This app implements the section-11 phased plan from `plan00.md` using:

- **Next.js 16** + App Router + React 19
- **Tiptap** rich text editing
- **Convex** backend scaffolding (schema, functions, auth wiring)
- **Local fallback stores** for development without Convex deployment
- **AI providers** via OpenAI / Anthropic / Gemini SDKs

## Implemented feature set

### Foundation
- Toolbar + split editor/AI layout
- New/Open/Share/Settings modals
- Document routes (`/editor`, `/editor/[documentId]`, `/sign-in`)

### Editor
- Tiptap editor with formatting toolbar
- Idle-save hook (5s) + deduplicated diff snapshots
- Version snapshots and restore flows

### AI Assistant
- Streaming AI chat panel
- Model selector
- AI lock handling in streaming route
- HTML edit parsing (search/replace + full HTML fallback)
- AI diff tagging (`Changes applied`) and clear-chat support

### Collaboration
- Presence + comments + permissions data flow
- Threaded comment replies
- Convex prosemirror-sync scaffolding

### Polish
- Version history modal with restore
- Export modal (Markdown, HTML, PDF print)
- Settings persistence (theme/model/font size/line spacing)
- Keyboard shortcuts (`Ctrl/Cmd+N`, `Ctrl/Cmd+O`, `Ctrl/Cmd+H`)
- Responsive AI drawer for small screens

## Development

Install dependencies:

```bash
npm install
```

Run app (minimum local mode):

```bash
npm run dev
```

Run validation:

```bash
npm test
npm run typecheck
npm run lint
```

## Full setup (all external services)

For full functionality (real-time backend, AI providers, and Google sign-in), configure:

- Convex deployment
- At least one AI provider key (OpenAI, Anthropic, or Gemini)
- Google OAuth client credentials

The repo includes `app/.env.local.template` with all required keys. Copy it first:

```bash
cp .env.local.template .env.local
```

Do not commit `.env.local`.

### 1) Convex (required for realtime backend)

1. Create/sign in to a Convex account.
2. From `app/`, run:
   ```bash
   npx convex dev
   ```
3. Complete the interactive prompts to create or connect a project.
4. Confirm `.env.local` contains:
   - `CONVEX_DEPLOYMENT`
   - `NEXT_PUBLIC_CONVEX_URL`
5. Keep `npx convex dev` running while developing so schema/functions stay synced.

Notes:

- If `NEXT_PUBLIC_CONVEX_URL` is missing, the app falls back to local browser storage mode.
- For cloud-backed features and auth routes, Convex should be configured.

### 2) AI provider keys (required for real AI edits)

You need at least one provider key. If none are set, AI uses local fallback behavior.

#### OpenAI

1. Go to OpenAI platform and sign in:
   - https://platform.openai.com/
2. Create an API key.
3. Add to `.env.local`:
   ```bash
   OPENAI_API_KEY=...
   ```
4. In app settings/model selector, choose an OpenAI model.

#### Anthropic

1. Go to Anthropic console and sign in:
   - https://console.anthropic.com/
2. Create an API key.
3. Add to `.env.local`:
   ```bash
   ANTHROPIC_API_KEY=...
   ```
4. Choose an Anthropic model in the app.

#### Gemini (Google AI)

1. Open Google AI Studio / Gemini API console:
   - https://aistudio.google.com/
2. Create an API key.
3. Add to `.env.local`:
   ```bash
   GEMINI_API_KEY=...
   ```
4. Choose a Gemini model in the app.

### 3) Google OAuth (required for Google sign-in)

This app uses Convex Auth + Google OAuth. The callback is handled by your Convex deployment.

1. In Google Cloud Console, create/select a project.
   - https://console.cloud.google.com/
2. Configure the OAuth consent screen.
   - For local/dev testing with External audience, add your Google account(s) as test users.
3. Create OAuth Client ID credentials for a **Web application**.
4. Configure OAuth client URLs:
   - **Authorized JavaScript origins**:
     - local dev: `http://localhost:3000` (or your actual Next.js origin)
   - **Authorized redirect URIs**:
     - `https://<your-convex-deployment>.convex.site/api/auth/callback/google`
     - Replace `<your-convex-deployment>` with your Convex deployment name.
     - Important: this must use `.convex.site` (HTTP Actions URL), not `.convex.cloud`.
5. Set Google credentials in your Convex deployment environment:
   ```bash
   npx convex env set AUTH_GOOGLE_CLIENT_ID <your-google-client-id>
   npx convex env set AUTH_GOOGLE_CLIENT_SECRET <your-google-client-secret>
   ```
6. Set your app URL in Convex so OAuth can redirect back correctly:
   ```bash
   npx convex env set SITE_URL http://localhost:3000
   ```
   - Use your real app URL/port if different.
7. Keep local app env pointing to Convex in `app/.env.local`:
   ```bash
   CONVEX_DEPLOYMENT=...
   NEXT_PUBLIC_CONVEX_URL=...
   ```
8. Restart both dev processes after env changes:
   ```bash
   npx convex dev
   npm run dev
   ```

If sign-in fails, verify redirect URI/origin values exactly match your current local + Convex URLs.

## Environment variable reference

`app/.env.local.template` includes:

```bash
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# AI providers (set at least one for real AI editing)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Google auth
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=
```

Note: `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` should also be set in Convex environment variables (`npx convex env set ...`) for Convex Auth to use them.

## OAuth troubleshooting

Common Google OAuth errors and fixes:

- `redirect_uri_mismatch`
  - Fix Authorized redirect URI in Google Cloud to:
    `https://<deployment>.convex.site/api/auth/callback/google`
- `origin_mismatch` / `unauthorized_origin`
  - Add your local app origin (for example `http://localhost:3000`) to Authorized JavaScript origins.
- `access_blocked` / app not verified / test-user issues
  - Ensure OAuth consent screen is configured and your account is added as a test user (for External app in testing mode).
- Redirects back to wrong port/domain
  - Set Convex `SITE_URL` to your actual app origin (`npx convex env set SITE_URL ...`).

## Recommended local run flow

In terminal 1 (Convex):

```bash
npx convex dev
```

In terminal 2 (Next.js app):

```bash
npm run dev
```
