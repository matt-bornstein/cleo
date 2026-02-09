# AI-Powered Collaborative Rich Text Editor — Project Plan

## 1. Overview

A real-time collaborative rich text editor built with **Next.js** (App Router) and **Convex** (database, file storage, backend functions, auth). The app features a dual-pane layout: a rich text editing panel on the left and an AI assistant chat panel on the right. Documents are stored as ProseMirror JSON (the editor's native format), with no markdown layer. AI communication uses HTML serialization. The app supports granular versioning, real-time collaborative editing, comments, and AI-assisted writing via leading LLM providers.

### Key Architectural Decision: No Markdown

The app stores and operates on **ProseMirror's native JSON document model** as the single source of truth. There is no raw markdown mode and no markdown ↔ ProseMirror conversion layer. This decision was made because:

1. **Consumer-first UX** — Target users expect a Google Docs-like rich text experience, not a markdown editing experience.
2. **No roundtrip fidelity issues** — ProseMirror JSON is lossless. What the user sees is exactly what's stored.
3. **Simplified collaboration** — y-prosemirror syncs the ProseMirror document directly. No translation layer between the collaborative state and the editor.
4. **Simplified AI integration** — The document is serialized to HTML for AI context, and AI HTML responses are parsed back to ProseMirror. HTML maps more directly to ProseMirror's node model than markdown does, and normalization in the HTML→ProseMirror direction is invisible to users (they only see the rendered view).
5. **Export is one-way** — Users can export as markdown, HTML, or PDF via a download button. Since it's a one-way operation, formatting normalization is irrelevant.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Backend / DB / Auth / Storage | Convex |
| Auth Provider | Google OAuth (via Convex Auth) |
| Rich Text Editor | Tiptap (ProseMirror-based) |
| Real-time Collaboration | Yjs + y-prosemirror + Convex as sync provider |
| AI Providers | OpenAI, Anthropic, Google (Gemini) |
| AI Edit Application | `prosemirror-recreate-steps` (for diffing ProseMirror docs) |
| Styling | Tailwind CSS + shadcn/ui |
| Diff Library | `diff-match-patch` (for HTML-level diffing in version history) |

---

## 3. Architecture

### 3.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                    │
│                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────┐ │
│  │   Editor Panel (2/3)     │  │  AI Panel (1/3)      │ │
│  │                          │  │                      │ │
│  │  Tiptap Rich Text Editor │  │  Chat messages       │ │
│  │  (formatting toolbar)    │  │  ...                 │ │
│  │                          │  │  Prompt input        │ │
│  │                          │  │  Model selector      │ │
│  └──────────────────────────┘  └──────────────────────┘ │
│                                                         │
│  Toolbar: [New] [Open] [Share] [Settings]               │
└────────────────────┬────────────────────────────────────┘
                     │ Convex React client
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Convex Backend                       │
│                                                         │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐            │
│  │  Documents  │ │  Diffs   │ │  Comments  │            │
│  │  table      │ │  table   │ │  table     │            │
│  └────────────┘ └──────────┘ └────────────┘            │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐            │
│  │  Users      │ │ Presence │ │ AI Chats   │            │
│  │  table      │ │  table   │ │  table     │            │
│  └────────────┘ └──────────┘ └────────────┘            │
│  ┌────────────────────────────┐                         │
│  │  Convex Actions (AI calls) │                         │
│  └────────────────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Document Storage: ProseMirror JSON in the Database

Documents are stored directly in the Convex database as ProseMirror JSON. This is the single source of truth.

**Why the database (not file storage):**

1. **Real-time collaboration** — Convex's reactive queries and mutations are designed for frequently-changing data. File storage is designed for blobs (images, PDFs), not data that changes every keystroke.
2. **Granular versioning / diffs** — Diffs reference a document at a point in time. With the document in the database, you can atomically snapshot and compute diffs in a single mutation.
3. **Comments and annotations** — Comments reference ProseMirror positions in the document. Much easier to manage when the document is a first-class database record.
4. **Transactional consistency** — A Convex mutation can atomically update the document content, write a diff record, and update presence data in one transaction.
5. **Performance** — Text documents are well within Convex's 1 MB document limit. ProseMirror JSON is somewhat larger than raw text (~2-3x) but a very long document's JSON would still be well under 1 MB.

**Use Convex file storage only for:** uploaded images or other binary assets embedded in documents.

### 3.3 Real-Time Collaboration: Yjs + y-prosemirror

- Use **Yjs** as the CRDT layer for conflict-free merging of concurrent edits.
- **y-prosemirror** binds Yjs directly to the ProseMirror/Tiptap editor. Edits are Yjs operations; collaboration is seamless.
- Convex acts as the **sync provider**: Yjs document updates (binary deltas) are sent via Convex mutations and broadcast to other clients via Convex subscriptions.
- The Yjs document state is periodically serialized to ProseMirror JSON and stored in the `documents` table for AI context, search, and version snapshots.
- Presence (cursors, selections, usernames) is handled by the Yjs awareness protocol, synced through the same Convex channel.

### 3.4 AI Edit Flow: HTML Serialization

The AI reads and writes **HTML**, not ProseMirror JSON or markdown. The flow:

```
ProseMirror doc → serialize to HTML → send to LLM
                                           │
LLM returns edited HTML ← ← ← ← ← ← ← ←┘
                                           │
Parse HTML → new ProseMirror doc (in memory)
                                           │
Diff old vs new ProseMirror doc → minimal Transactions
                                           │
Dispatch transactions through editor (via y-prosemirror)
                                           │
All clients receive changes as normal collaborative edits ✓
```

**Why HTML over markdown for AI:**
- ProseMirror has lossless, built-in HTML serialization (`DOMSerializer`) and parsing (`DOMParser`).
- HTML maps more directly to ProseMirror's node types (paragraphs, headings, lists, tables, etc.) than markdown does.
- LLMs are highly capable at reading and writing HTML.
- No markdown normalization concerns — what the LLM returns is exactly what the user sees.

**Why this doesn't cause flicker:**
- AI changes are applied as surgical ProseMirror `Transaction` steps, not via `setContent`.
- `prosemirror-recreate-steps` diffs the old and new ProseMirror documents and produces the minimal `Step` sequence.
- These steps go through y-prosemirror, so all clients receive them as normal collaborative edits.
- Cursors, selections, and scroll positions outside the changed region are preserved for all users.

---

## 4. Data Model (Convex Schema)

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- Users ---
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    // Convex auth fields are managed automatically
  }).index("by_email", ["email"]),

  // --- Documents ---
  documents: defineTable({
    title: v.string(),
    content: v.string(),              // ProseMirror JSON (stringified)
    yjsState: v.optional(v.bytes()),  // serialized Yjs doc state
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_updatedAt", ["updatedAt"]),

  // --- Document Permissions ---
  permissions: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("commenter"),
      v.literal("viewer")
    ),
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"])
    .index("by_document_user", ["documentId", "userId"]),

  // --- Diffs / Version History ---
  diffs: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),            // who made the change
    patch: v.string(),                // the diff (HTML-level diff via diff-match-patch)
    snapshotAfter: v.string(),        // ProseMirror JSON snapshot after applying the diff
    source: v.union(
      v.literal("ai"),               // change made by AI assistant
      v.literal("manual"),           // change made by user (idle-save)
      v.literal("created")           // initial document creation
    ),
    aiPrompt: v.optional(v.string()), // the user's prompt if source is "ai"
    aiModel: v.optional(v.string()),  // model used if source is "ai"
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_document_time", ["documentId", "createdAt"]),

  // --- Comments ---
  comments: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    content: v.string(),              // comment text
    // Position anchoring via ProseMirror positions
    anchorFrom: v.number(),           // ProseMirror position start
    anchorTo: v.number(),             // ProseMirror position end
    anchorText: v.string(),           // the text that was highlighted (for re-anchoring fallback)
    resolved: v.boolean(),
    parentCommentId: v.optional(v.id("comments")), // for threaded replies
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_parent", ["parentCommentId"]),

  // --- AI Chat Messages ---
  aiMessages: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.optional(v.string()),    // which model responded
    diffId: v.optional(v.id("diffs")), // link to the diff created by this AI response
    iteration: v.optional(v.number()), // 0 = initial, 1-3 = verification loop
    createdAt: v.number(),
  }).index("by_document", ["documentId"]),
});
```

### 4.1 Notes on the Schema

**Why `content` is a stringified JSON, not a Convex object:** ProseMirror JSON is deeply nested with variable structure (different node types, optional attrs, variable-length content arrays). Storing it as a string avoids fighting Convex's type system for a structure that is better validated by ProseMirror itself.

**Why `snapshotAfter` in diffs:** Every diff record includes a full ProseMirror JSON snapshot of the document after the change. This allows any version to be restored without replaying the entire diff chain. Storage cost is acceptable for text documents.

**Comment anchoring:** Comments use ProseMirror positions (`anchorFrom`, `anchorTo`) which are stable within a document version. For collaborative editing, Yjs relative positions should be used client-side to track comment anchors as the document changes. The `anchorText` field is a fallback for re-anchoring if positions are lost.

**No separate presence table:** Presence (cursors, selections) is handled entirely by the Yjs awareness protocol, which is ephemeral and in-memory. No need to persist it in the database.

---

## 5. Feature Breakdown

### 5.1 Authentication

- **Convex Auth** with Google OAuth as the sole provider.
- On first sign-in, create a `users` record.
- Protect all routes; unauthenticated users are redirected to a sign-in page.

### 5.2 Top Toolbar (Modals)

| Button | Modal Content |
|---|---|
| **New** | Title input, creates a blank document. |
| **Open** | Lists user's documents (owned + shared). Search/filter by title. |
| **Share** | Show current permissions. Add users by email. Set role (editor/commenter/viewer). Copy shareable link. |
| **Settings** | User profile, default AI model, theme (light/dark), editor preferences (font size, line spacing, etc.). |

### 5.3 Editor Panel (Left, 2/3 Width)

#### Rich Text Editor (Tiptap)
- Rich text editor powered by **Tiptap** (ProseMirror-based).
- Formatting toolbar with buttons: bold, italic, underline, strikethrough, headings (H1-H3), bullet list, ordered list, task list, code block, blockquote, horizontal rule, link, image, table.
- Yjs binding via `y-prosemirror` for real-time collaboration.
- Collaborator cursors and selections rendered as colored overlays with name labels.

#### Formatting Toolbar Design
- Fixed toolbar at the top of the editor panel (below the main app toolbar).
- Buttons are grouped logically: Text style | Headings | Lists | Insert (link, image, table, code block, blockquote, rule).
- Active formatting is visually indicated (e.g., bold button is highlighted when cursor is in bold text).
- Keyboard shortcuts for common formatting (Cmd/Ctrl+B, Cmd/Ctrl+I, etc.).

#### Idle-Save Diff
- A **5-second idle timer** triggers after the last edit.
- On trigger, serialize the current ProseMirror doc to HTML, compute a diff between the last saved HTML snapshot and the current HTML.
- If changes are detected, store a new `diffs` record with `source: "manual"`.
- Update the document's `content` field (ProseMirror JSON) and `updatedAt` timestamp.
- Implementation: `useEffect` with a debounced callback watching Yjs updates.

### 5.4 AI Assistant Panel (Right, 1/3 Width)

#### UI Design (Cursor-inspired)
- **Chat message list** — scrollable, top-to-bottom, newest at bottom.
  - User messages: left-aligned with user avatar.
  - Assistant messages: left-aligned with model icon. Content rendered as rich text.
  - Show which model produced each response.
  - Show a "changes applied" indicator when an AI response modified the document.
- **Prompt input** — text input at the bottom, with send button. Supports `Shift+Enter` for multi-line, `Enter` to send.
- **Model selector** — dropdown/pill selector below the input.
  - OpenAI: `gpt-4o`, `gpt-4.1`
  - Anthropic: `claude-sonnet-4-20250514`
  - Google: `gemini-2.5-pro`
  - (Models list should be easily configurable / updated.)

#### AI Interaction Flow

```
User submits prompt
        │
        ▼
┌─────────────────────────────────────┐
│ 1. Build context:                   │
│    - System prompt                  │
│    - Document as HTML               │
│    - User's prompt                  │
│ 2. Call selected model              │
│ 3. Parse response (extract HTML)    │
│ 4. Diff old ↔ new ProseMirror docs  │
│ 5. Apply as Transactions (via Yjs)  │
│ 6. Save diff record (source: "ai")  │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ Verification loop (up to 3x):      │
│ 1. Send updated doc HTML + prompt:  │
│    "Check that the change has been  │
│    implemented correctly. Say OK    │
│    if so, or make more changes."    │
│ 2. If model says OK → stop          │
│ 3. If model makes changes →         │
│    apply, save diff, repeat         │
└─────────────────────────────────────┘
```

#### Applying AI Responses (Detailed)

**Step-by-step process:**

1. **Serialize** the current ProseMirror document to HTML using Tiptap's `editor.getHTML()`.
2. **Send** the HTML + user prompt + system prompt to the selected model.
3. **Parse** the model's response to extract the edited HTML (from a code fence or the full response).
4. **Create** a temporary ProseMirror document by parsing the response HTML using `DOMParser` from ProseMirror (not the browser's DOMParser).
5. **Diff** the current ProseMirror doc against the new one using `prosemirror-recreate-steps` to produce a minimal list of `Step` objects.
6. **Dispatch** these steps as a ProseMirror `Transaction` through the editor. Since y-prosemirror is active, these steps are automatically synced to all collaborators.
7. **Save** a diff record with the HTML-level diff (for version history) and the new ProseMirror JSON snapshot.

**Fallback for large changes:** If `prosemirror-recreate-steps` fails or produces too many steps (indicating a near-total rewrite), fall back to `editor.commands.setContent()` wrapped in a Yjs transaction. This may briefly disrupt collaborator cursors but ensures the change is applied.

#### AI Response Format

The system prompt instructs the model to return edits as **search/replace blocks operating on the HTML**:

**Strategy 1: HTML Search-and-Replace Blocks (Preferred)**
```
<<<SEARCH
<p>exact HTML to find</p>
===
<p>replacement HTML</p>
>>>
```
- The backend applies these to the HTML string, then parses the result to ProseMirror.
- More token-efficient for small edits.

**Strategy 2: Full HTML Document (Fallback)**
- The model returns the complete updated HTML in a code fence.
- Used for large-scale rewrites.

The system prompt includes instructions for both formats.

#### Context Management for Long Documents

If the document is too long to fit in the model's context window, several strategies can be considered:

1. **Truncation with summary** — Send the first N characters of the HTML, plus a summary of the rest generated by a cheaper/faster model. The summary preserves document structure (headings, section names) so the model understands the full layout.

2. **Chunked editing** — Split the document by top-level block nodes (headings as section dividers). Send only the relevant section(s) based on the user's prompt (using keyword matching or embeddings), plus a structural outline of the full document.

3. **Sliding window with overlap** — Send a window of HTML around the user's cursor position, with overlap. The model edits within the window, and edits are stitched back.

4. **Map-reduce** — For whole-document operations (e.g., "fix all grammar"), split into sections, process each independently, and merge.

5. **Progressive summarization** — Maintain a running summary of the document. Send the summary + the specific section being edited.

6. **Use models with very large context windows** — Gemini 2.5 Pro supports 1M tokens. For most documents, context limits won't be hit. The UI could suggest switching to a large-context model when needed.

> **Decision deferred** — For v1, warn the user if the document exceeds the context window and suggest a larger-context model. Implement truncation-with-summary as the first fallback.

### 5.5 Versioning System

Every version is stored as a `diffs` record:

| Trigger | `source` | Details |
|---|---|---|
| AI makes changes | `"ai"` | `aiPrompt` and `aiModel` are populated. `diffId` linked from `aiMessages`. |
| User idle for 5s | `"manual"` | Auto-saved. No prompt. |
| Document created | `"created"` | Initial empty document. |

**Diff format:** Diffs are computed at the HTML level using `diff-match-patch`. The HTML is serialized from the ProseMirror doc before and after the change. The patch is stored as a serialized `diff-match-patch` patch string.

**Snapshot strategy:** Every diff record includes `snapshotAfter` — the full ProseMirror JSON of the document after the change. This allows any version to be restored instantly without replaying diffs.

**Version history UI** (future consideration): A timeline/list view accessible from the toolbar or a side panel showing all versions, with the ability to preview (render the ProseMirror JSON snapshot) and restore any version.

### 5.6 Sharing and Permissions

- Each document has an **owner** (the creator).
- The owner can share with other users by email, assigning a role:
  - **Editor** — can edit, comment, and view.
  - **Commenter** — can comment and view.
  - **Viewer** — can only view.
- Permissions are checked server-side in every Convex mutation/query.
- The Share modal shows current collaborators and their roles, with the ability to change roles or revoke access.
- Shareable links: Generate a link containing the document ID. When a user opens the link, they are prompted to sign in if not already, and then granted viewer access (or the role specified by the owner).

### 5.7 Comments

- Users can select text in the editor and add a comment.
- Comments appear in a right-side margin or sidebar, anchored to the selected text with a connecting line/highlight.
- Threaded replies are supported (via `parentCommentId`).
- Comments can be resolved (hidden but not deleted).
- Real-time: Comments are stored in Convex and appear instantly for all collaborators via reactive queries.
- Comment anchor positions are tracked using Yjs relative positions on the client side, so they survive concurrent edits.

### 5.8 Presence

- Each user's cursor position, selection range, and name/color are broadcast to all collaborators viewing the same document.
- Implemented via **Yjs awareness protocol**, synced through the Convex-based Yjs provider.
- Cursors and selections are rendered as colored overlays in the Tiptap editor, with a small name label next to each remote cursor.
- Stale awareness states (no update in 30s) are automatically cleaned up by Yjs.
- No database table needed — awareness is ephemeral.

---

## 6. Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ConvexProvider, AuthProvider)
│   ├── page.tsx                  # Landing / redirect to editor
│   ├── sign-in/
│   │   └── page.tsx              # Google OAuth sign-in page
│   ├── editor/
│   │   └── [documentId]/
│   │       └── page.tsx          # Main editor page (editor + AI panel)
│   └── api/                      # (if needed for webhooks, etc.)
│
├── components/
│   ├── layout/
│   │   ├── Toolbar.tsx           # Top toolbar with action buttons
│   │   └── EditorLayout.tsx      # 2/3 + 1/3 split layout
│   ├── editor/
│   │   ├── EditorPanel.tsx       # Container for Tiptap editor
│   │   ├── RichTextEditor.tsx    # Tiptap editor instance + config
│   │   ├── FormattingToolbar.tsx # Bold, italic, headings, etc.
│   │   └── CollaboratorCursors.tsx
│   ├── ai/
│   │   ├── AIPanel.tsx           # AI assistant container
│   │   ├── ChatMessages.tsx      # Message list
│   │   ├── ChatInput.tsx         # Prompt input
│   │   ├── ModelSelector.tsx     # Model dropdown
│   │   └── MessageBubble.tsx     # Individual message
│   ├── modals/
│   │   ├── NewDocModal.tsx
│   │   ├── OpenDocModal.tsx
│   │   ├── ShareModal.tsx
│   │   └── SettingsModal.tsx
│   ├── comments/
│   │   ├── CommentsSidebar.tsx
│   │   ├── CommentThread.tsx
│   │   └── CommentInput.tsx
│   └── ui/                       # shadcn/ui components
│
├── convex/
│   ├── schema.ts                 # Database schema
│   ├── auth.ts                   # Auth configuration (Google OAuth)
│   ├── users.ts                  # User queries/mutations
│   ├── documents.ts              # Document CRUD, permissions checks
│   ├── diffs.ts                  # Diff storage, version history
│   ├── comments.ts               # Comment CRUD
│   ├── permissions.ts            # Permission management
│   ├── ai.ts                     # AI actions (model calls)
│   └── _generated/               # Convex generated files
│
├── lib/
│   ├── ai/
│   │   ├── prompts.ts            # System prompts, templates
│   │   ├── models.ts             # Model definitions and config
│   │   ├── parseResponse.ts      # Parse search/replace or full-doc HTML responses
│   │   └── applyChanges.ts       # Diff ProseMirror docs, apply as Transactions
│   ├── editor/
│   │   ├── yjs-convex-provider.ts # Custom Yjs provider using Convex
│   │   ├── extensions.ts         # Tiptap extension configuration
│   │   └── diffing.ts            # HTML diff computation for version history
│   ├── permissions.ts            # Permission checking utilities
│   └── utils.ts                  # General utilities
│
├── hooks/
│   ├── useDocument.ts            # Document loading and subscription
│   ├── useIdleSave.ts            # 5-second idle auto-save with diff
│   ├── useAIChat.ts              # AI chat interaction logic
│   └── useComments.ts            # Comments management
│
├── public/
├── tailwind.config.ts
├── next.config.js
├── package.json
├── tsconfig.json
└── .env.local                    # (client-side env vars only; API keys go in Convex)
```

---

## 7. Convex Backend Functions

### 7.1 Auth (`convex/auth.ts`)
- Configure Convex Auth with Google OAuth provider.
- `afterAuth` hook to create/update user record on sign-in.

### 7.2 Documents (`convex/documents.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Create a new document (title, empty ProseMirror JSON, set owner). |
| `get` | query | Get a document by ID (with permission check). |
| `list` | query | List documents accessible to the current user. |
| `updateContent` | mutation | Update document ProseMirror JSON and `updatedAt` (with editor permission check). |
| `updateYjsState` | mutation | Store serialized Yjs state (called periodically by the sync provider). |
| `applyYjsUpdate` | mutation | Apply a Yjs binary delta and broadcast to subscribers. |
| `delete` | mutation | Delete a document (owner only). |

### 7.3 Diffs (`convex/diffs.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Store a new diff record (with ProseMirror JSON snapshot). |
| `listByDocument` | query | List all diffs for a document, ordered by time. |
| `getVersion` | query | Get a specific version's ProseMirror JSON snapshot. |
| `restore` | mutation | Restore a document to a specific version (replaces content, creates a new diff). |

### 7.4 AI (`convex/ai.ts`)

| Function | Type | Description |
|---|---|---|
| `submitPrompt` | action | Main AI flow: receive HTML + prompt, call model, return response. |
| `callModel` | (internal) | Call the appropriate AI provider API based on model selection. |
| `saveMessage` | mutation | Store an AI chat message. |
| `getMessages` | query | Get chat history for a document. |

> **Note:** `submitPrompt` is a Convex **action** (not a mutation) because it makes external HTTP calls to AI APIs. It calls mutations internally to save messages. The actual ProseMirror diffing and transaction application happens **client-side** (where the Tiptap editor instance lives), not in the Convex action.

### 7.5 Comments (`convex/comments.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Add a comment (with commenter/editor permission check). |
| `list` | query | List comments for a document. |
| `resolve` | mutation | Mark a comment as resolved. |
| `reply` | mutation | Add a reply to a comment thread. |
| `delete` | mutation | Delete a comment (author or document owner only). |

### 7.6 Permissions (`convex/permissions.ts`)

| Function | Type | Description |
|---|---|---|
| `share` | mutation | Add/update a permission entry (owner only). |
| `unshare` | mutation | Remove a permission entry (owner only). |
| `getPermissions` | query | List all permissions for a document. |
| `getMyRole` | query | Get the current user's role for a document. |

---

## 8. AI Integration Details

### 8.1 API Keys and Configuration
- API keys for OpenAI, Anthropic, and Google are stored as **Convex environment variables**, because AI calls happen in Convex actions on the server.
- Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`.

### 8.2 System Prompt (Draft)

```
You are an AI writing assistant helping edit a rich text document. The user will give you instructions for changes to make. The document is provided as HTML.

RESPONSE FORMAT:
- For small, targeted changes, use SEARCH/REPLACE blocks operating on the HTML:

<<<SEARCH
<p>exact HTML to find in the document</p>
===
<p>replacement HTML</p>
>>>

- For large-scale changes or rewrites, return the FULL updated HTML inside a code fence:

```html
(full document HTML here)
```

RULES:
- SEARCH blocks must match the document HTML EXACTLY (including tags, attributes, and whitespace).
- You may use multiple SEARCH/REPLACE blocks in one response.
- Only return the changed portions — do not include unchanged HTML outside of blocks.
- If you return a full document, it replaces the entire current document.
- Always preserve the document's existing structure and formatting unless asked to change it.
- Use standard HTML elements: <h1>-<h3>, <p>, <strong>, <em>, <u>, <s>, <ul>, <ol>, <li>, <blockquote>, <pre><code>, <a>, <img>, <table>, <tr>, <td>, <th>, <hr>.
- Briefly explain what you changed before the blocks.
```

### 8.3 Verification Loop Prompt

```
Review the document below and check whether the previous change was implemented correctly and completely based on the original request: "{original_prompt}"

If everything looks correct, respond with exactly: OK

If there are issues or the change was not fully implemented, make the necessary corrections using the same SEARCH/REPLACE format.

Document:
{current_document_html}
```

### 8.4 Model Calling

Use the official SDKs for each provider within Convex actions:
- `openai` npm package for OpenAI models
- `@anthropic-ai/sdk` for Anthropic models
- `@google/generative-ai` for Gemini models

Each model call should:
1. Track token usage (for potential future billing/limits).
2. Stream responses where possible for better UX.
3. Handle rate limits with exponential backoff.
4. Set reasonable timeouts (60s for initial call, 30s for verification).

### 8.5 Streaming Responses

For a good UX, AI responses should stream to the client:
- Use a Convex HTTP action that returns a streaming response, consumed by the client via `fetch` with a `ReadableStream`.
- The chat panel displays tokens as they arrive.
- Document changes are applied only after the full response is received and parsed (not during streaming), to avoid partial/broken HTML being applied to the editor.

### 8.6 Client-Side AI Orchestration

The AI flow is orchestrated **client-side** (in the `useAIChat` hook), not entirely server-side:

1. Client serializes the ProseMirror doc to HTML.
2. Client calls the Convex `submitPrompt` action, which calls the LLM and returns the response.
3. Client parses the response (search/replace blocks or full HTML).
4. Client applies changes to the local Tiptap editor as ProseMirror Transactions.
5. Client saves the diff record via a Convex mutation.
6. Client repeats for verification loop iterations.

This approach keeps the Tiptap editor instance (which only exists client-side) in the loop for applying changes. The Convex action is a pure AI-calling function — it doesn't need to know about ProseMirror.

---

## 9. Yjs + Convex Integration

This is the most technically challenging piece. A custom Yjs provider must be built that uses Convex as the transport and persistence layer.

### 9.1 Architecture

```
Client A (Yjs Doc)  ←──→  Convex  ←──→  Client B (Yjs Doc)
     │                        │                    │
     └── y-prosemirror ───────┘──── y-prosemirror ─┘
         (Tiptap)                       (Tiptap)
                              │
                    ┌─────────┴──────────┐
                    │  documents table    │
                    │  - yjsState (bytes) │
                    │  - content (string) │ ← ProseMirror JSON
                    └────────────────────┘
```

### 9.2 Sync Protocol

1. **On document open:** Client fetches the Yjs state from `documents.yjsState` and initializes a local Yjs doc from it.
2. **On local edit:** The Yjs doc emits an update (binary delta). The client sends this delta to Convex via a mutation (`documents.applyYjsUpdate`).
3. **Convex mutation:** Merges the delta into the stored Yjs state. The mutation is reactive, so all subscribed clients receive the new state.
4. **On remote update:** Clients subscribed to the document receive the merged Yjs state and apply it to their local Yjs doc. y-prosemirror translates this into ProseMirror transactions automatically.
5. **Periodic snapshot:** Every N updates (or every M seconds), the ProseMirror JSON is extracted from the editor and written to `documents.content` for use by AI, search, and diffs.

### 9.3 Considerations

- **Bandwidth:** Yjs updates are compact binary deltas (typically bytes to low KB). Convex mutations handle this well.
- **Latency:** Convex reactive queries typically deliver updates in ~50-100ms, which is acceptable for collaborative editing.
- **Conflict resolution:** Handled entirely by Yjs CRDT — no server-side merge logic needed.
- **Offline support:** Yjs supports offline editing natively. When the client reconnects, accumulated updates are synced.
- **Awareness (presence):** Cursor positions, selections, and user info are synced via the Yjs awareness protocol through the same Convex channel. No separate presence table needed.

---

## 10. UI/UX Design Notes

### 10.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ [New] [Open] [Share] [Settings]          Document Title │
├──────────────────────────────┬──────────────────────────┤
│ B I U S  H1 H2 H3  • 1. ☐  │                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━  │                          │
│                              │     AI Assistant Panel   │
│       Tiptap Editor          │     (1/3 width)          │
│       (2/3 width)            │                          │
│                              │   ┌──────────────────┐   │
│   Rich text content here.    │   │  Message 1       │   │
│   Users type directly into   │   │  Message 2       │   │
│   this WYSIWYG editor.       │   │  ...             │   │
│                              │   │                  │   │
│   Collaborator cursors are   │   ├──────────────────┤   │
│   visible as colored lines   │   │ [Prompt input  ] │   │
│   with name labels.          │   │ [Model: GPT-4o ] │   │
│                              │   └──────────────────┘   │
└──────────────────────────────┴──────────────────────────┘
```

### 10.2 Design Principles
- **Clean and minimal** — Focus on the content. The editor should feel spacious, like a modern word processor.
- **Dark and light themes** — Default to system preference, configurable in Settings.
- **Responsive** — On smaller screens, the AI panel collapses to a toggleable drawer.
- **Keyboard shortcuts** — `Cmd/Ctrl+B` bold, `Cmd/Ctrl+I` italic, `Cmd/Ctrl+Enter` submit AI prompt, etc.

### 10.3 Colors and Styling
- Use Tailwind CSS with shadcn/ui for consistent, accessible components.
- Collaborator cursors use a predefined palette of 8+ distinct colors assigned round-robin.
- AI panel uses subtle background differentiation from the editor panel.
- Formatting toolbar uses icon buttons with tooltips showing the keyboard shortcut.

---

## 11. Implementation Phases

### Phase 1: Foundation
1. Initialize Next.js project with Tailwind, shadcn/ui.
2. Set up Convex project and schema.
3. Implement Google OAuth with Convex Auth.
4. Create basic layout (toolbar, 2/3 + 1/3 split).
5. Implement New Doc and Open Doc modals with basic CRUD.

### Phase 2: Editor
1. Integrate Tiptap with formatting toolbar.
2. Configure Tiptap extensions (StarterKit, underline, task lists, tables, links, images, code blocks).
3. Implement document loading: fetch ProseMirror JSON from Convex, load into Tiptap.
4. Implement document saving: serialize ProseMirror JSON, save to Convex.
5. Implement idle-save (5s debounce) with HTML diff computation and diff record storage.

### Phase 3: AI Assistant
1. Build AI chat panel UI (messages, input, model selector).
2. Implement Convex actions for calling OpenAI, Anthropic, Google APIs.
3. Implement prompt building (system prompt + HTML serialized document + user prompt).
4. Implement response parsing (HTML search/replace blocks + full-HTML fallback).
5. Implement change application: parse response HTML → ProseMirror doc → diff → Transactions.
6. Implement verification loop (up to 3 iterations).
7. Add streaming support for AI responses in the chat panel.

### Phase 4: Collaboration
1. Build custom Yjs-Convex sync provider.
2. Integrate y-prosemirror with Tiptap for collaborative editing.
3. Implement presence (cursors, selections, collaborator labels) via Yjs awareness.
4. Implement Share modal with permission management.
5. Add permission checks to all Convex functions.
6. Implement comments (create, thread, resolve, anchor tracking).

### Phase 5: Polish
1. Version history UI (timeline, preview, restore).
2. Settings modal (theme, editor preferences, default model).
3. Export functionality (markdown, HTML, PDF).
4. Keyboard shortcuts.
5. Error handling, loading states, and optimistic updates.
6. Performance optimization (debouncing, pagination of document list).
7. Mobile/responsive layout adjustments.

---

## 12. Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "convex": "^1.x",
    "@convex-dev/auth": "^0.x",
    "@tiptap/react": "^2.x",
    "@tiptap/starter-kit": "^2.x",
    "@tiptap/extension-underline": "^2.x",
    "@tiptap/extension-task-list": "^2.x",
    "@tiptap/extension-task-item": "^2.x",
    "@tiptap/extension-table": "^2.x",
    "@tiptap/extension-link": "^2.x",
    "@tiptap/extension-image": "^2.x",
    "@tiptap/extension-collaboration": "^2.x",
    "@tiptap/extension-collaboration-cursor": "^2.x",
    "yjs": "^13.x",
    "y-prosemirror": "^1.x",
    "prosemirror-recreate-steps": "^1.x",
    "openai": "^4.x",
    "@anthropic-ai/sdk": "^0.x",
    "@google/generative-ai": "^0.x",
    "diff-match-patch": "^1.x",
    "tailwindcss": "^3.x",
    "@radix-ui/react-dialog": "^1.x",
    "class-variance-authority": "^0.x",
    "lucide-react": "^0.x"
  }
}
```

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Yjs + Convex integration complexity | High | Prototype the sync provider early (Phase 4). Consider using `y-websocket` as a reference implementation. If Convex sync latency is too high, consider a dedicated WebSocket server for Yjs and use Convex only for persistence. |
| `prosemirror-recreate-steps` failing on complex diffs | Medium | Fall back to `setContent` inside a Yjs transaction for near-total rewrites. Test with many AI response patterns. Consider maintaining a fork if the library needs fixes. |
| AI models returning unparseable HTML | Medium | Implement robust parsing with fallback to full-doc replacement. Validate HTML structure before applying. Add retry logic. |
| Document too large for AI context | Medium | Defer to large-context models (Gemini 2.5 Pro). Implement truncation warning. |
| ProseMirror JSON size in database | Low | ProseMirror JSON is ~2-3x larger than raw text, but well within Convex's 1 MB limit for any reasonable document. Monitor and warn for extreme cases. |
| Comment anchor drift during concurrent edits | Medium | Use Yjs relative positions for anchoring client-side. Store `anchorText` as fallback for re-anchoring. |
| HTML injection / XSS from AI responses | Medium | ProseMirror's DOMParser sanitizes HTML by only allowing known node/mark types. Untrusted HTML tags are stripped. Validate responses before applying. |

---

## 14. Important Questions

> **Question 1 (Markdown fidelity / editor approach) — RESOLVED:** Using pure ProseMirror/Tiptap with ProseMirror JSON as the storage format. No markdown. HTML serialization for AI communication. No raw editing mode.

2. **AI response streaming UX:** When the AI is making changes, should the document update live as tokens stream in, or should the changes be applied all at once after the full response is received? Live updates look impressive but could be disorienting for collaborators. Batch application is safer but less responsive.

3. **Conflict between AI edits and concurrent human edits:** If a user is typing while the AI is also modifying the document, how should conflicts be handled? Options: (a) Lock the document during AI edits, (b) Let Yjs CRDT merge both, (c) Apply AI changes as a separate "user" in the CRDT and let the merge happen naturally. Option (c) is most elegant but may produce unexpected results if edits overlap.

4. **Verification loop — what if the model keeps making changes?** The current design caps verification at 3 iterations. But what if the model alternates between two states? Should we add a check to detect oscillation (e.g., if the diff of iteration N reverses the diff of iteration N-1, stop)?

5. **Per-user settings scope:** Should settings (theme, default model, font size) be per-user globally or per-user-per-document? Global is simpler; per-document allows different preferences for different contexts.

6. **Document title management:** Should the document title be derived from the first H1 in the document, or should it be a separate editable field? If separate, should changes to the title be versioned like content changes?

7. **AI chat history persistence:** Should the AI chat history persist permanently for each document, or should there be an option to clear it? Should chat history be included in the context sent to the AI (i.e., multi-turn conversation), and if so, how many past messages?

8. **Real-time presence performance:** How many concurrent collaborators should be supported? Yjs awareness can handle dozens, but Convex mutation rate may become a bottleneck if presence updates fire on every cursor movement. Should presence updates be throttled (e.g., max 5 updates/second per user)?

9. **Shareable links — public access?** Should shareable links require the recipient to have a Google account and sign in, or should there be an option for "anyone with the link" (public/anonymous) access? The current design assumes all users must authenticate.

10. **Cost management for AI calls:** Should there be any usage limits or rate limiting on AI API calls per user? The verification loop (up to 3 extra calls per prompt) could get expensive. Should users be warned about token costs or have a configurable max token budget?

11. **Offline support scope:** Yjs supports offline editing natively. Should the app explicitly support offline mode (with visible indicator, queue of unsynced changes, etc.), or is it acceptable to require an active connection?
