# Known Issues & Status

## ✅ Fully Implemented Features
- Rich text editor (Tiptap 3.x) with full formatting toolbar (20+ buttons)
- Real-time collaboration via @convex-dev/prosemirror-sync (OT)
- AI edits applied via prosemirrorSync.transform() for live OT sync to all clients
- Remote cursor decorations showing other users' positions and names
- Presence indicators in toolbar
- AI assistant with 4 model providers (OpenAI, Anthropic, Google)
- Streaming AI responses with rich message rendering (code blocks, diff visualization)
- "Changes applied" indicator on AI messages
- AI context includes proper HTML and user name prefixes
- Version history with preview and restore
- HTML-level diffs via diff-match-patch (not placeholder text)
- Comment highlight decorations in the editor (yellow highlights on anchored text)
- Comments with text anchoring, threads, resolve
- Comment creation from editor text selection
- Document sharing with role-based permissions (owner/editor/commenter/viewer)
- Permission-gated prosemirror-sync API (checkRead/checkWrite hooks)
- HTML, Markdown, plain text, and PDF export
- Responsive layout (mobile drawer for AI panel with floating toggle)
- Error boundary and offline disconnection banner
- Dark/light/system theme with flash prevention
- User settings synced to Convex (theme, model, font size)
- Inline document title editing
- Idle-save with server-side deduplication
- AI diff records for version history
- AI lock indicator for collaborators
- Server-side prosemirror-sync document creation on doc create

## Requirements for Setup
- **Google OAuth**: Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` as Convex env vars
- **AI API Keys**: Set one or more of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

## Remaining Limitations
1. **Comment anchor remapping** — Comment positions (from/to) are not remapped when the document is concurrently edited. The `anchorText` field provides a fallback for re-anchoring.
2. **Image upload** — Images are inserted via URL only. File upload to Convex storage is not implemented.
3. **No offline editing** — The app requires an active connection. A disconnection banner is shown when offline.
