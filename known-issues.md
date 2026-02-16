# Known Issues

## Authentication
- Google OAuth requires actual Google Cloud credentials (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET env vars)
- Without credentials, sign-in will fail. For development, users need to configure Google OAuth.

## AI Assistant
- AI API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY) must be set as Convex environment variables
- Server-side document transform via prosemirror-recreate-steps not yet implemented (AI edits are chat-only for now)
- HTML serialization for AI context uses raw ProseMirror JSON instead of proper HTML (needs linkedom integration in Convex action)

## Export
- Export functionality is placeholder-only (HTML and text export outputs dummy content)
- PDF export not implemented
- Proper export needs to serialize the Tiptap editor content on the client side

## Collaboration
- Remote cursor rendering (colored overlays with names) not yet implemented visually
- Comment anchor remapping during concurrent edits not implemented
- Presence data is tracked but not displayed as cursor overlays in the editor

## Editor
- Image upload is URL-only (no file upload to Convex storage)
- No offline support

## Settings
- Settings are stored in localStorage only (not synced to Convex user settings)
- Theme toggle works but may flash on page load
