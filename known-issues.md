# Known Issues

## Authentication
- Google OAuth requires actual Google Cloud credentials (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET env vars)
- Without credentials, sign-in will fail. For development, users need to configure Google OAuth.
- Set credentials via: `npx convex env set AUTH_GOOGLE_ID <id>` and `npx convex env set AUTH_GOOGLE_SECRET <secret>`

## AI Assistant
- AI API keys must be set as Convex environment variables:
  - `npx convex env set OPENAI_API_KEY <key>`
  - `npx convex env set ANTHROPIC_API_KEY <key>`
  - `npx convex env set GEMINI_API_KEY <key>`
- Server-side document transform via prosemirror-recreate-steps not yet implemented
  - AI responses are chat-only; search/replace blocks are parsed but not applied to the document
  - Full implementation requires: linkedom for server DOM, prosemirror-recreate-steps for minimal transforms
- HTML context sent to AI uses raw ProseMirror JSON instead of proper HTML serialization

## Collaboration
- Remote cursor rendering (colored overlays with name labels) not yet visually rendered in the editor
  - Presence data is tracked and displayed in the toolbar, but cursor positions are not drawn as decorations
  - Full implementation requires a custom Tiptap extension/decoration plugin
- Comment anchor remapping during concurrent edits not implemented
  - Comments store positions but they may drift as the document is edited

## Editor
- Image upload is URL-only (no file upload to Convex storage)
- No offline support (shows "Loading" when disconnected)

## Settings
- Settings are stored in localStorage only (not synced to Convex user settings table)
- This means settings don't sync across devices

## Export
- ✅ HTML export implemented with proper ProseMirror JSON -> HTML conversion
- ✅ Plain text export implemented
- PDF export not implemented (would need html2pdf or browser print)
