# AI-Powered Collaborative Rich Text Editor

A real-time collaborative rich text editor built with **Next.js 16**, **Convex**, **Tiptap 3**, and AI assistant capabilities from OpenAI, Anthropic, and Google.

## Features

### Rich Text Editing
- Full WYSIWYG editor powered by Tiptap 3 (ProseMirror-based)
- Formatting toolbar: bold, italic, underline, strikethrough, headings (H1-H3), lists (bullet, ordered, task), blockquote, code blocks, horizontal rules, links, images, tables
- Active state indicators and keyboard shortcuts

### AI Assistant
- Chat panel with streaming responses
- Multiple AI model support: GPT-4o, GPT-4.1, Claude Sonnet 4, Gemini 2.5 Pro
- Search/replace and full-document edit formats
- Per-document chat history with clear functionality
- AI lock system to prevent concurrent AI requests

### Real-Time Collaboration
- Operational transformation via `@convex-dev/prosemirror-sync`
- Multi-user editing with conflict resolution
- Presence indicators showing online collaborators
- Document permissions (owner, editor, commenter, viewer)

### Version History
- Automatic idle-save with 5-second debounce
- Server-side deduplication of saves
- Version timeline with restore capability
- AI edits tracked separately from manual saves

### Document Management
- Create, open, search, and delete documents
- Share documents by email with role assignment
- Inline title editing

### Comments
- Text-anchored comments with position tracking
- Threaded replies
- Resolve/delete functionality

### Export
- HTML export with full formatting
- Plain text export

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| React | React 19 |
| Backend / DB / Auth | Convex |
| Auth Provider | Google OAuth (via Convex Auth) |
| Rich Text Editor | Tiptap 3.x |
| Real-time Collaboration | @convex-dev/prosemirror-sync |
| AI Providers | OpenAI, Anthropic, Google |
| Styling | Tailwind CSS 4 + shadcn/ui |

## Getting Started

### Prerequisites
- Node.js 20.9+
- A Convex account (or use local development)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Push Convex schema and functions:
   ```bash
   npm run convex:push
   ```

4. Set up authentication:
   ```bash
   npm run setup:auth
   npx convex env set SITE_URL http://localhost:3000
   ```

5. Start Convex development server (in one terminal):
   ```bash
   npm run convex:dev
   ```

6. Start Next.js development server (in another terminal):
   ```bash
   npm run dev
   ```

7. Open http://localhost:3000

The app supports two auth methods:
- **Email/Password** — works immediately, no external setup needed
- **Google OAuth** — requires Google Cloud credentials:
  ```bash
  npx convex env set AUTH_GOOGLE_ID <your-google-client-id>
  npx convex env set AUTH_GOOGLE_SECRET <your-google-client-secret>
  ```

### AI API Keys

Set one or more as Convex environment variables:

```bash
npx convex env set OPENAI_API_KEY <your-key>
npx convex env set ANTHROPIC_API_KEY <your-key>
npx convex env set GEMINI_API_KEY <your-key>
```

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home / document list
│   ├── sign-in/            # Sign-in page
│   └── editor/[documentId] # Editor page
├── components/
│   ├── ai/                 # AI chat panel components
│   ├── editor/             # Tiptap editor components
│   ├── layout/             # Layout components (toolbar, etc.)
│   ├── modals/             # Modal dialogs
│   ├── comments/           # Comment system components
│   └── ui/                 # shadcn/ui components
├── convex/
│   ├── schema.ts           # Database schema
│   ├── documents.ts        # Document CRUD
│   ├── permissions.ts      # Permission management
│   ├── ai.ts               # AI lock, messages
│   ├── diffs.ts            # Version history
│   ├── comments.ts         # Comments
│   ├── presence.ts         # Presence (online users)
│   ├── prosemirrorSync.ts  # Real-time collaboration
│   ├── http.ts             # HTTP actions (AI streaming)
│   └── crons.ts            # Scheduled jobs
├── hooks/                  # React hooks
├── lib/                    # Utility libraries
│   ├── ai/                 # AI prompts, models, parsing
│   ├── editor/             # Editor configuration
│   └── export.ts           # Document export
└── known-issues.md         # Known limitations
```

## Development Scripts

```bash
npm run dev           # Start Next.js dev server
npm run convex:dev    # Start Convex dev server (local anonymous backend)
npm run convex:push   # Push Convex functions once
npm run setup:auth    # Generate and set JWT keys for auth
npm run test          # Run tests
npm run test:watch    # Run tests in watch mode
npm run typecheck     # TypeScript type checking
npm run build         # Production build
npm run lint          # ESLint
```

## Testing

```bash
npm test
```

## License

Private
