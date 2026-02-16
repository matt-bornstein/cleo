# Known Issues

## Authentication
- Google OAuth requires actual Google Cloud credentials
  - Set via: `npx convex env set AUTH_GOOGLE_ID <id>` and `npx convex env set AUTH_GOOGLE_SECRET <secret>`
  - Without credentials, sign-in will fail

## AI Assistant
- AI API keys must be set as Convex environment variables:
  - `npx convex env set OPENAI_API_KEY <key>`
  - `npx convex env set ANTHROPIC_API_KEY <key>`
  - `npx convex env set GEMINI_API_KEY <key>`
- ✅ AI now sends proper HTML to the LLM (not raw ProseMirror JSON)
- ✅ AI search/replace blocks and full HTML replacements are applied to the document
- Note: The document content is updated via a cached content field, not via the real-time
  prosemirror-sync transform() API. This means AI edits will appear as a new document state
  on next load, not as incremental OT steps. Full prosemirror-sync integration requires
  running ProseMirror schema + linkedom in the Convex action environment.

## Collaboration
- ✅ Remote cursor positions are now rendered as colored decorations with name labels
- ✅ Presence indicators shown in toolbar
- Comment anchor remapping during concurrent edits is not implemented
  - Comments store positions but they may drift as the document is edited

## Editor
- Image upload is URL-only (no file upload to Convex storage)
- No offline support (shows "Loading" when disconnected)

## Settings
- ✅ Settings are now synced to Convex (userSettings table)
- Also saved to localStorage for immediate theme application

## Export
- ✅ HTML export with full formatting (uses live editor.getHTML() when available)
- ✅ Plain text export
- PDF export not implemented

## Comments
- ✅ Comment creation from editor text selection via toolbar button
- ✅ Threaded replies, resolve, delete
