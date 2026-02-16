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

Run app:

```bash
npm run dev
```

Run validation:

```bash
npm test
npm run typecheck
npm run lint
```

## Environment variables

Create `.env.local` in `app/` if needed:

```bash
NEXT_PUBLIC_CONVEX_URL=<convex-deployment-url>
OPENAI_API_KEY=<optional>
ANTHROPIC_API_KEY=<optional>
GEMINI_API_KEY=<optional>
AUTH_GOOGLE_ID=<optional>
AUTH_GOOGLE_SECRET=<optional>
```

If `NEXT_PUBLIC_CONVEX_URL` is missing, the app runs in local fallback mode using browser storage.

## Current known limitation

Convex CLI deployment/codegen could not be fully initialized in this terminal environment due non-interactive login constraints. The codebase includes Convex schema/function scaffolding and local fallback implementations so development and tests remain functional.
