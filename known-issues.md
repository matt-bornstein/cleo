# Known Issues & Status

## ✅ All Plan Features Implemented
- Rich text editor (Tiptap 3.x) with full formatting toolbar
- Real-time collaboration via @convex-dev/prosemirror-sync (OT)
- AI edits applied via prosemirrorSync.transform() for live OT sync
- Remote cursor decorations with name labels
- Presence indicators in toolbar
- AI assistant with 4 model providers (OpenAI, Anthropic, Google)
- Streaming AI responses with rich message rendering
- Version history with preview, restore, and HTML-level diffs
- Comment highlights with anchor remapping (text search fallback)
- Comments with text anchoring, threads, resolve
- Comment creation from editor text selection
- Document sharing with role-based permissions
- Permission-gated prosemirror-sync API
- HTML, Markdown, plain text, and PDF export
- Image upload to Convex file storage (+ URL insertion)
- Responsive layout (mobile drawer for AI panel)
- Error boundary and offline disconnection banner
- Dark/light/system theme
- User settings synced to Convex
- Idle-save with server-side deduplication
- Email/password + Google OAuth auth

## Setup Requirements
- **Auth keys**: `node scripts/setup-auth-keys.mjs`
- **Site URL**: `npx convex env set SITE_URL http://localhost:3000`
- **Google OAuth** (optional): Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
- **AI**: Set one or more of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

## Remaining Limitations
1. **No offline editing** — Plan explicitly defers: "v1 is online-only."
2. **Auth on anonymous local backend** — JWT validation may not work on the anonymous local development backend. Works correctly with a real Convex deployment.
