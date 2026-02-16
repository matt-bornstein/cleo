# Known Issues & Status

## ✅ Fully Implemented Features
- Rich text editor (Tiptap 3.x) with full formatting toolbar
- Real-time collaboration via @convex-dev/prosemirror-sync (OT)
- Remote cursor decorations showing other users' positions and names
- Presence indicators in toolbar
- AI assistant with 4 model providers (OpenAI, Anthropic, Google)
- AI applies search/replace and full HTML edits to the document
- AI diff records saved for version history
- Streaming AI responses in chat panel
- Version history with restore
- Comments with text anchoring, threads, resolve
- Comment creation from editor text selection
- Document sharing with role-based permissions
- HTML, Markdown, and plain text export
- Responsive layout (mobile drawer for AI panel)
- Error boundary and offline disconnection banner
- Dark/light/system theme with flash prevention
- User settings synced to Convex (theme, model, font size)
- Inline document title editing
- Idle-save with server-side deduplication

## Requirements for Setup
- **Google OAuth**: Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` as Convex env vars
- **AI API Keys**: Set one or more of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

## Remaining Limitations
1. **AI edits via cached content** — AI edits update the document content cache, not the real-time prosemirror-sync state. This means AI changes appear on the next reload rather than as live OT steps. Full prosemirror-sync integration requires ProseMirror schema + linkedom running in Convex actions.
2. **Comment anchor remapping** — Comment positions (from/to) are not remapped when the document is concurrently edited. They may drift. The `anchorText` field provides a fallback for re-anchoring.
3. **Image upload** — Images are inserted via URL only. File upload to Convex storage is not implemented.
4. **No offline editing** — The app requires an active connection. Offline support is not implemented.
5. **PDF export** — Not implemented. HTML and Markdown exports are available.
