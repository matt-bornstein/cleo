# AI-Powered Collaborative Markdown Editor — Project Plan

## 1. Overview

A real-time collaborative markdown editor built with **Next.js** (App Router) and **Convex** (database, file storage, backend functions, auth). The app features a dual-pane layout: a markdown editing panel on the left and an AI assistant chat panel on the right. Files are stored as markdown, support granular versioning with diffs, real-time collaborative editing, comments, and AI-assisted writing via leading LLM providers.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Backend / DB / Auth / Storage | Convex |
| Auth Provider | Google OAuth (via Convex Auth) |
| Rich Text Editor | Tiptap (ProseMirror-based, with markdown serialization) |
| Raw Markdown Editor | CodeMirror 6 |
| Real-time Collaboration | Yjs + Convex as sync provider |
| AI Providers | OpenAI, Anthropic, Google (Gemini) |
| Styling | Tailwind CSS + shadcn/ui |
| Diff Library | `diff-match-patch` or `jsdiff` |

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
│  │  [Rendered] / [Raw]      │  │  Chat messages       │ │
│  │                          │  │  ...                 │ │
│  │  Tiptap ↔ CodeMirror     │  │  Prompt input        │ │
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

### 3.2 Why Store Documents in the Database (Not File Storage)

**Recommendation: Store document content directly in the Convex database, not in Convex file storage.**

Rationale:

1. **Real-time collaboration** — Convex's reactive queries and mutations are designed for data that changes frequently. Storing content in a database field means every edit can be a mutation that triggers reactive updates for all connected clients. File storage is designed for blobs (images, PDFs), not for data that changes every keystroke.

2. **Granular versioning / diffs** — Diffs reference a document at a point in time. If the document is a database field, you can atomically snapshot it and compute a diff in a single mutation — no race conditions with file uploads/downloads.

3. **Comments and annotations** — Comments reference character ranges or positions in the document. These are much easier to resolve and update when the document is a first-class database record.

4. **Transactional consistency** — A Convex mutation can atomically update the document content, write a diff record, and update presence data in one transaction. File storage operations are not transactional in the same way.

5. **Performance** — For text documents (even long ones), the data size is well within Convex document limits (1 MB per document). A very long markdown file would be ~500K characters — still under the limit.

**Use file storage only for:** uploaded images or other binary assets embedded in documents.

### 3.3 Real-Time Collaboration Strategy

Real-time collaborative editing requires a conflict resolution strategy. The two leading approaches are:

#### Option A: Yjs CRDT with Convex as Transport/Persistence

- Use **Yjs** as the CRDT layer for conflict-free merging of concurrent edits.
- Both Tiptap and CodeMirror 6 have first-class Yjs bindings (`y-prosemirror`, `y-codemirror.next`).
- Convex acts as the **sync provider**: Yjs document updates (binary deltas) are sent via Convex mutations and broadcast to other clients via Convex subscriptions.
- The Yjs document state is periodically serialized and stored in the Convex `documents` table as the canonical markdown content (for AI context, search, etc.).
- Presence (cursors, selections, usernames) is handled by Yjs awareness protocol, synced through the same Convex channel.

**Storage model with Yjs:**
- `documents.content` — the latest serialized markdown (updated on snapshot)
- `documents.yjsState` — the binary Yjs document state (Uint8Array stored as base64 or via Convex bytes)  
- Diffs are computed from the markdown content at snapshot points.

#### Option B: Convex-Native OT / Last-Write-Wins

- Rely on Convex mutations + optimistic updates to handle edits.
- Simpler to implement but does not handle concurrent edits gracefully at the character level.
- Would require custom conflict resolution logic.

**Recommendation: Option A (Yjs)**. It is the industry standard for collaborative editors, both target editors (Tiptap, CodeMirror) have mature Yjs plugins, and it handles presence natively.

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
    content: v.string(),              // latest markdown content
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
    patch: v.string(),                // the diff (unified diff or diff-match-patch format)
    contentAfter: v.string(),         // full content snapshot after applying the diff
    source: v.union(
      v.literal("ai"),               // change made by AI assistant
      v.literal("manual"),           // change made by user (idle-save)
      v.literal("upload")            // initial upload
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
    // Position anchoring — these reference the markdown content
    anchorStart: v.number(),          // character offset start
    anchorEnd: v.number(),            // character offset end
    anchorText: v.string(),           // the text that was highlighted (for re-anchoring if offsets shift)
    resolved: v.boolean(),
    parentCommentId: v.optional(v.id("comments")), // for threaded replies
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_parent", ["parentCommentId"]),

  // --- Presence ---
  presence: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    cursor: v.optional(v.object({
      anchor: v.number(),
      head: v.number(),
    })),
    selection: v.optional(v.object({
      anchor: v.number(),
      head: v.number(),
    })),
    lastSeen: v.number(),
    color: v.string(),                // assigned collaborator color
  })
    .index("by_document", ["documentId"])
    .index("by_document_user", ["documentId", "userId"]),

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

### 4.1 Notes on Comment Anchoring

Comments are anchored by character offset and also store the highlighted text (`anchorText`). When collaborative edits shift character positions, the system should attempt to re-anchor comments by searching for `anchorText` near the original offset. Yjs also provides relative positions that survive concurrent edits — this can be used if Yjs is the source of truth.

---

## 5. Feature Breakdown

### 5.1 Authentication

- **Convex Auth** with Google OAuth as the sole provider.
- On first sign-in, create a `users` record.
- Protect all routes; unauthenticated users are redirected to a sign-in page.

### 5.2 Top Toolbar (Modals)

| Button | Modal Content |
|---|---|
| **New File** | Title input, creates a blank document. |
| **Open File** | Lists user's documents (owned + shared). Option to upload a `.md` file. Search/filter by title. |
| **Share** | Show current permissions. Add users by email. Set role (editor/commenter/viewer). Copy shareable link. |
| **Settings** | User profile, default AI model, theme (light/dark), editor preferences (font size, tab size, etc.). |

### 5.3 Editor Panel (Left, 2/3 Width)

#### Rendered Mode (Tiptap)
- Rich text editor powered by **Tiptap** (ProseMirror-based).
- Toolbar with formatting buttons: bold, italic, headings, lists, code blocks, links, images, blockquotes, horizontal rules, tables.
- Content is synchronized bidirectionally with the underlying markdown via a markdown serializer/parser (e.g., `tiptap-markdown` extension or custom `prosemirror-markdown`).
- Yjs binding via `y-prosemirror` for real-time collaboration.

#### Raw Mode (CodeMirror 6)
- Displays raw markdown in a code-editor experience with syntax highlighting.
- Uses `@codemirror/lang-markdown` for markdown syntax support.
- Yjs binding via `y-codemirror.next` for real-time collaboration.

#### Mode Switching
- Small toggle buttons at the bottom of the editor pane: **[Rendered]** **[Raw]**.
- Both modes share the same underlying Yjs document, so switching is seamless — edits in one mode are immediately reflected in the other.
- Active mode is visually indicated (e.g., filled vs. outlined button).

#### Idle-Save Diff
- A **5-second idle timer** triggers after the last edit.
- On trigger, compute a diff between the last saved snapshot and the current content.
- If changes are detected, store a new `diffs` record with `source: "manual"`.
- Update the document's `content` field and `updatedAt` timestamp.
- Implementation: `useEffect` with a debounced callback watching Yjs updates.

### 5.4 AI Assistant Panel (Right, 1/3 Width)

#### UI Design (Cursor-inspired)
- **Chat message list** — scrollable, top-to-bottom, newest at bottom.
  - User messages: right-aligned or left-aligned with user avatar.
  - Assistant messages: left-aligned with model icon. Rendered as markdown.
  - Show which model produced each response.
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
┌─────────────────────────┐
│ 1. Build context:       │
│    - System prompt       │
│    - Full document       │
│    - User's prompt       │
│ 2. Call selected model   │
│ 3. Apply changes to doc  │
│ 4. Save diff (source:ai) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────┐
│ Verification loop (up to 3x):  │
│ 1. Send updated doc + prompt:  │
│    "Check that the change has  │
│    been implemented correctly.  │
│    Say OK if so, or make more  │
│    changes if not."            │
│ 2. If model says OK → stop     │
│ 3. If model makes changes →    │
│    apply, save diff, repeat    │
└─────────────────────────────────┘
```

#### Applying AI Responses

**Approach: Diff-based with full-doc fallback.**

The system prompt should instruct the model to return edits in a structured format. Two strategies, in order of preference:

**Strategy 1: Search-and-Replace Blocks (Preferred)**
- Instruct the model to return one or more search-and-replace blocks:
  ```
  <<<SEARCH
  exact text to find
  ===
  replacement text
  >>>
  ```
- The frontend parses these blocks and applies them sequentially.
- If any search block fails to match (text not found), fall back to Strategy 2 for that response.
- **Pros:** Smaller responses, faster, cheaper, works well for targeted edits.
- **Cons:** Requires the model to return exact matching text; may fail on long documents.

**Strategy 2: Full Document Replacement (Fallback)**
- Instruct the model to return the full updated document wrapped in a code fence.
- The frontend replaces the entire document content.
- A diff is computed between old and new content for the version history.
- **Pros:** Always works, simple to implement.
- **Cons:** Expensive for large documents, slower, more tokens.

The system prompt should try Strategy 1 first and include instructions for both formats so the model can choose based on the scope of changes.

#### Context Management for Long Documents

If the document is too long to fit in the model's context window (along with the system prompt, chat history, and response space), several strategies can be considered:

1. **Truncation with summary** — Send the first N characters of the document, plus a summary of the rest generated by a cheaper/faster model. The summary preserves document structure (headings, section names) so the model understands the full layout.

2. **Chunked editing** — Split the document by headings/sections. Send only the relevant section(s) based on the user's prompt (using keyword matching or embeddings to identify relevant sections), plus a structural outline of the full document.

3. **Sliding window with overlap** — Send a window of text around the user's cursor position, with overlap regions. The model edits within the window, and edits are stitched back into the full document.

4. **Map-reduce** — For whole-document operations (e.g., "fix all grammar"), split the document into chunks, process each chunk independently, and merge results.

5. **Progressive summarization** — Maintain a running summary of the document that fits in context. Send the summary + the specific section being edited.

6. **Use models with very large context windows** — Gemini 2.5 Pro supports 1M tokens (~3M characters of markdown). For most documents, context limits won't be hit with this model. The UI could suggest switching to a large-context model when the document is too long for the selected model.

> **Decision deferred** — The right approach depends on real-world usage patterns. For v1, simply warn the user if the document exceeds the context window and suggest using a larger-context model. Implement truncation-with-summary as the first fallback.

### 5.5 Versioning System

Every version is stored as a `diffs` record:

| Trigger | `source` | Details |
|---|---|---|
| AI makes changes | `"ai"` | `aiPrompt` and `aiModel` are populated. `diffId` linked from `aiMessages`. |
| User idle for 5s | `"manual"` | Auto-saved. No prompt. |
| File uploaded | `"upload"` | Initial content. Diff is empty (or vs. empty doc). |

**Version history UI** (future consideration): A timeline/list view accessible from the toolbar or a side panel showing all diffs for a document, with the ability to preview and restore any version.

**Diff format:** Use `diff-match-patch` library (Google's algorithm). It produces compact, human-readable patches and supports robust patch application even when the document has shifted. Store as serialized patch string.

**Snapshot strategy:** Every diff record includes `contentAfter` (the full document content after the diff was applied). This ensures any version can be restored without replaying the entire diff chain. The storage cost is acceptable for text documents.

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
- Comments appear in a sidebar or inline, anchored to the selected text.
- Threaded replies are supported (via `parentCommentId`).
- Comments can be resolved (hidden but not deleted).
- Real-time: Comments are stored in Convex and appear instantly for all collaborators via reactive queries.

### 5.8 Presence

- Each user's cursor position, selection range, and name/color are broadcast to all collaborators viewing the same document.
- Implemented via Yjs awareness protocol, synced through Convex.
- Cursors and selections are rendered as colored overlays in both Tiptap and CodeMirror.
- A small name label is shown next to each remote cursor.
- Stale presence records (no heartbeat in 30s) are automatically cleaned up.

---

## 6. Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ConvexProvider, AuthProvider)
│   ├── page.tsx                  # Landing / redirect to /editor
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
│   │   ├── EditorPanel.tsx       # Container for rendered/raw mode
│   │   ├── RenderedEditor.tsx    # Tiptap rich text editor
│   │   ├── RawEditor.tsx         # CodeMirror raw markdown editor
│   │   ├── ModeToggle.tsx        # Rendered/Raw toggle buttons
│   │   └── CollaboratorCursors.tsx
│   ├── ai/
│   │   ├── AIPanel.tsx           # AI assistant container
│   │   ├── ChatMessages.tsx      # Message list
│   │   ├── ChatInput.tsx         # Prompt input
│   │   ├── ModelSelector.tsx     # Model dropdown
│   │   └── MessageBubble.tsx     # Individual message
│   ├── modals/
│   │   ├── NewFileModal.tsx
│   │   ├── OpenFileModal.tsx
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
│   ├── presence.ts               # Presence mutations/queries
│   ├── ai.ts                     # AI actions (model calls)
│   └── _generated/               # Convex generated files
│
├── lib/
│   ├── ai/
│   │   ├── prompts.ts            # System prompts, templates
│   │   ├── models.ts             # Model definitions and config
│   │   ├── parseResponse.ts      # Parse search/replace or full-doc responses
│   │   └── applyChanges.ts       # Apply AI changes to document
│   ├── editor/
│   │   ├── yjs-convex-provider.ts # Custom Yjs provider using Convex
│   │   ├── markdown.ts           # Markdown ↔ Tiptap conversion utilities
│   │   └── diffing.ts            # Diff computation utilities
│   ├── permissions.ts            # Permission checking utilities
│   └── utils.ts                  # General utilities
│
├── hooks/
│   ├── useDocument.ts            # Document loading and subscription
│   ├── usePresence.ts            # Presence management
│   ├── useIdleSave.ts            # 5-second idle auto-save with diff
│   ├── useAIChat.ts              # AI chat interaction logic
│   └── useComments.ts            # Comments management
│
├── public/
├── tailwind.config.ts
├── next.config.js
├── package.json
├── tsconfig.json
└── .env.local                    # API keys (OpenAI, Anthropic, Google AI)
```

---

## 7. Convex Backend Functions

### 7.1 Auth (`convex/auth.ts`)
- Configure Convex Auth with Google OAuth provider.
- `afterAuth` hook to create/update user record on sign-in.

### 7.2 Documents (`convex/documents.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Create a new document (title, empty content, set owner). |
| `get` | query | Get a document by ID (with permission check). |
| `list` | query | List documents accessible to the current user. |
| `update` | mutation | Update document content and `updatedAt` (with editor permission check). |
| `updateYjsState` | mutation | Store serialized Yjs state (called periodically). |
| `upload` | mutation | Create a document from an uploaded `.md` file. |
| `delete` | mutation | Delete a document (owner only). |

### 7.3 Diffs (`convex/diffs.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Store a new diff record. |
| `listByDocument` | query | List all diffs for a document, ordered by time. |
| `getVersion` | query | Get a specific version's content (`contentAfter`). |
| `restore` | mutation | Restore a document to a specific version. |

### 7.4 AI (`convex/ai.ts`)

| Function | Type | Description |
|---|---|---|
| `submitPrompt` | action | Main AI flow: build context, call model, parse response, apply changes, save diff, run verification loop. |
| `callModel` | (internal) | Call the appropriate AI provider API based on model selection. |
| `saveMessage` | mutation | Store an AI chat message. |
| `getMessages` | query | Get chat history for a document. |

> **Note:** `submitPrompt` is a Convex **action** (not a mutation) because it makes external HTTP calls to AI APIs. It calls mutations internally to save messages and diffs.

### 7.5 Presence (`convex/presence.ts`)

| Function | Type | Description |
|---|---|---|
| `update` | mutation | Update cursor/selection position for a user in a document. |
| `getByDocument` | query | Get all active presence records for a document. |
| `heartbeat` | mutation | Update `lastSeen` timestamp. |
| `cleanup` | (cron/scheduled) | Remove stale presence records (lastSeen > 30s ago). |

> **Note on Yjs-based presence:** If Yjs awareness is used for presence, the `presence` table may be simplified or eliminated, since Yjs awareness handles ephemeral presence data in-memory. The table would only be needed if presence must survive page reloads or be queryable server-side.

### 7.6 Comments (`convex/comments.ts`)

| Function | Type | Description |
|---|---|---|
| `create` | mutation | Add a comment (with commenter/editor permission check). |
| `list` | query | List comments for a document. |
| `resolve` | mutation | Mark a comment as resolved. |
| `reply` | mutation | Add a reply to a comment thread. |
| `delete` | mutation | Delete a comment (author or document owner only). |

### 7.7 Permissions (`convex/documents.ts` or separate file)

| Function | Type | Description |
|---|---|---|
| `share` | mutation | Add/update a permission entry (owner only). |
| `unshare` | mutation | Remove a permission entry (owner only). |
| `getPermissions` | query | List all permissions for a document. |
| `getMyRole` | query | Get the current user's role for a document. |

---

## 8. AI Integration Details

### 8.1 API Keys and Configuration
- API keys for OpenAI, Anthropic, and Google are stored as **Convex environment variables** (not `.env.local`), because AI calls happen in Convex actions on the server.
- Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`.

### 8.2 System Prompt (Draft)

```
You are an AI writing assistant helping edit a markdown document. The user will give you instructions for changes to make.

RESPONSE FORMAT:
- For small, targeted changes, use SEARCH/REPLACE blocks:

<<<SEARCH
exact text to find in the document
===
replacement text
>>>

- For large-scale changes or rewrites, return the FULL updated document inside a markdown code fence:

```markdown
(full document here)
```

RULES:
- SEARCH blocks must match the document text EXACTLY (including whitespace and punctuation).
- You may use multiple SEARCH/REPLACE blocks in one response.
- Only return the changed portions — do not include unchanged text outside of blocks.
- If you return a full document, it replaces the entire current document.
- Always preserve the document's existing formatting style unless asked to change it.
- Briefly explain what you changed before the blocks.
```

### 8.3 Verification Loop Prompt

```
Review the document below and check whether the previous change was implemented correctly and completely based on the original request: "{original_prompt}"

If everything looks correct, respond with exactly: OK

If there are issues or the change was not fully implemented, make the necessary corrections using the same SEARCH/REPLACE format.

Document:
{current_document_content}
```

### 8.4 Model Calling

Use the official SDKs for each provider within Convex actions:
- `openai` npm package for OpenAI models
- `@anthropic-ai/sdk` for Anthropic models
- `@google/generative-ai` for Gemini models

Each model call should:
1. Track token usage (for potential future billing/limits).
2. Stream responses where possible for better UX (display tokens as they arrive in the chat panel).
3. Handle rate limits with exponential backoff.
4. Set reasonable timeouts (60s for initial call, 30s for verification).

### 8.5 Streaming Responses

For a good UX, AI responses should stream to the client:
- Convex actions can use **HTTP streaming** or store partial results that the client subscribes to.
- One approach: Write partial message content to the `aiMessages` table in chunks, and the client reactively displays updates.
- Another approach: Use a Convex HTTP action that returns a streaming response, consumed by the client via `fetch` with a `ReadableStream`.

**Recommendation:** Use Convex HTTP actions with streaming for the initial implementation, as it provides the most responsive feel.

---

## 9. Yjs + Convex Integration

This is the most technically challenging piece. A custom Yjs provider must be built that uses Convex as the transport and persistence layer.

### 9.1 Architecture

```
Client A (Yjs Doc)  ←──→  Convex  ←──→  Client B (Yjs Doc)
     │                        │                    │
     └── y-prosemirror        │           y-codemirror.next ──┘
         (Tiptap)             │           (CodeMirror)
                              │
                    ┌─────────┴──────────┐
                    │  documents table    │
                    │  - yjsState (bytes) │
                    │  - content (string) │
                    └────────────────────┘
```

### 9.2 Sync Protocol

1. **On document open:** Client fetches the Yjs state from `documents.yjsState` and initializes a local Yjs doc from it.
2. **On local edit:** The Yjs doc emits an update (binary delta). The client sends this delta to Convex via a mutation (`documents.applyYjsUpdate`).
3. **Convex mutation:** Merges the delta into the stored Yjs state. The mutation is reactive, so all subscribed clients receive the new state.
4. **On remote update:** Clients subscribed to the document receive the merged Yjs state and apply it to their local Yjs doc.
5. **Periodic snapshot:** Every N updates (or every M seconds), the markdown content is extracted from the Yjs doc and written to `documents.content` for use by AI, search, and diffs.

### 9.3 Considerations

- **Bandwidth:** Yjs updates are compact binary deltas (typically bytes to low KB). Convex mutations handle this well.
- **Latency:** Convex reactive queries typically deliver updates in ~50-100ms, which is acceptable for collaborative editing.
- **Conflict resolution:** Handled entirely by Yjs CRDT — no server-side merge logic needed. Convex just stores and broadcasts.
- **Offline support:** Yjs supports offline editing natively. When the client reconnects, accumulated updates are synced.

---

## 10. UI/UX Design Notes

### 10.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ [New] [Open] [Share] [Settings]          Document Title │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│       Editor Panel           │     AI Assistant Panel   │
│       (2/3 width)            │     (1/3 width)          │
│                              │                          │
│   ┌──────────────────────┐   │   ┌──────────────────┐   │
│   │                      │   │   │  Message 1       │   │
│   │   Tiptap / CodeMirror│   │   │  Message 2       │   │
│   │                      │   │   │  ...             │   │
│   │                      │   │   │                  │   │
│   │                      │   │   │                  │   │
│   │                      │   │   ├──────────────────┤   │
│   │                      │   │   │ [Prompt input  ] │   │
│   └──────────────────────┘   │   │ [Model: GPT-4o ] │   │
│   [Rendered] [Raw]           │   └──────────────────┘   │
├──────────────────────────────┴──────────────────────────┤
│                          (status bar - optional)        │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Design Principles
- **Clean and minimal** — Focus on the content. The editor should feel spacious.
- **Dark and light themes** — Default to system preference, configurable in Settings.
- **Responsive** — On smaller screens, the AI panel could collapse to a toggleable drawer.
- **Keyboard shortcuts** — `Cmd/Ctrl+S` to force save, `Cmd/Ctrl+Enter` to submit AI prompt, `Cmd/Ctrl+Shift+M` to toggle editor mode.

### 10.3 Colors and Styling
- Use Tailwind CSS with shadcn/ui for consistent, accessible components.
- Collaborator cursors use a predefined palette of 8+ distinct colors assigned round-robin.
- AI panel uses subtle background differentiation from the editor panel.

---

## 11. Implementation Phases

### Phase 1: Foundation
1. Initialize Next.js project with Tailwind, shadcn/ui.
2. Set up Convex project and schema.
3. Implement Google OAuth with Convex Auth.
4. Create basic layout (toolbar, 2/3 + 1/3 split).
5. Implement New File and Open File modals with basic CRUD.

### Phase 2: Editor
1. Integrate Tiptap for rendered mode.
2. Integrate CodeMirror 6 for raw mode.
3. Implement mode toggle (shared document state).
4. Set up Yjs with both editors sharing a single Yjs doc.
5. Implement markdown ↔ Tiptap content conversion.
6. Implement idle-save (5s debounce) with diff computation and storage.

### Phase 3: AI Assistant
1. Build AI chat panel UI (messages, input, model selector).
2. Implement Convex actions for calling OpenAI, Anthropic, Google APIs.
3. Implement prompt building (system prompt + document + user prompt).
4. Implement response parsing (search/replace blocks + full-doc fallback).
5. Implement change application and diff storage.
6. Implement verification loop (up to 3 iterations).
7. Add streaming support for AI responses.

### Phase 4: Collaboration
1. Build custom Yjs-Convex sync provider.
2. Implement presence (cursors, selections, collaborator labels).
3. Implement Share modal with permission management.
4. Add permission checks to all Convex functions.
5. Implement comments (create, thread, resolve).

### Phase 5: Polish
1. Version history UI (timeline, preview, restore).
2. Settings modal (theme, editor preferences, default model).
3. Keyboard shortcuts.
4. Error handling and loading states.
5. Performance optimization (debouncing, pagination).
6. Mobile/responsive layout adjustments.

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
    "tiptap-markdown": "^0.x",
    "@codemirror/view": "^6.x",
    "@codemirror/state": "^6.x",
    "@codemirror/lang-markdown": "^6.x",
    "yjs": "^13.x",
    "y-prosemirror": "^1.x",
    "y-codemirror.next": "^0.x",
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
| AI models returning unparseable responses | Medium | Implement robust parsing with fallback to full-doc replacement. Add retry logic. Test with many prompt types. |
| Document too large for AI context | Medium | Defer to large-context models (Gemini 2.5 Pro). Implement truncation warning. |
| Comment anchoring drift during edits | Medium | Use Yjs relative positions for anchoring. Fall back to text search if relative position is lost. |
| Convex document size limit (1 MB) | Low | Very long documents (~500K+ characters) could approach the limit. Monitor and warn. For v1, this is unlikely to be hit. |
| Mode switching (rendered ↔ raw) consistency | Medium | Both modes share the same Yjs doc. Tiptap's markdown serialization must be lossless. Test round-trip fidelity extensively. |

---

## 14. Important Questions

1. **Markdown fidelity in rendered mode:** Tiptap (ProseMirror) has its own internal document model. Converting markdown → ProseMirror → markdown can be lossy for some edge-case markdown syntax (e.g., reference-style links, HTML blocks, nested blockquotes). Should we accept some loss, or constrain the supported markdown subset? Should we treat the Yjs ProseMirror doc as the source of truth and always serialize to markdown, or treat raw markdown as the source of truth?

2. **AI response streaming UX:** When the AI is making changes, should the document update live as tokens stream in, or should the changes be applied all at once after the full response is received? Live updates look impressive but could be disorienting for collaborators. Batch application is safer but less responsive.

3. **Conflict between AI edits and concurrent human edits:** If a user is typing while the AI is also modifying the document, how should conflicts be handled? Options: (a) Lock the document during AI edits, (b) Let Yjs CRDT merge both, (c) Apply AI changes as a separate "user" in the CRDT and let the merge happen naturally. Option (c) is most elegant but may produce unexpected results if edits overlap.

4. **Verification loop — what if the model keeps making changes?** The current design caps verification at 3 iterations. But what if the model alternates between two states? Should we add a check to detect oscillation (e.g., if the diff of iteration N reverses the diff of iteration N-1, stop)?

5. **Per-user settings scope:** Should settings (theme, default model, font size) be per-user globally or per-user-per-document? Global is simpler; per-document allows different preferences for different contexts.

6. **Upload vs. paste:** The spec says "only markdown files can be uploaded." Should the app also support pasting markdown content directly into the Open File modal (e.g., from clipboard), or only `.md` file uploads?

7. **Document title management:** Should the document title be derived from the first `# Heading` in the markdown, or should it be a separate editable field? If separate, should changes to the title be versioned like content changes?

8. **AI chat history persistence:** Should the AI chat history persist permanently for each document, or should there be an option to clear it? Should chat history be included in the context sent to the AI (i.e., multi-turn conversation), and if so, how many past messages?

9. **Real-time presence performance:** How many concurrent collaborators should be supported? Yjs awareness can handle dozens, but Convex mutation rate may become a bottleneck if presence updates fire on every cursor movement. Should presence updates be throttled (e.g., max 5 updates/second per user)?

10. **Shareable links — public access?** Should shareable links require the recipient to have a Google account and sign in, or should there be an option for "anyone with the link" (public/anonymous) access? The current design assumes all users must authenticate.

11. **Cost management for AI calls:** Should there be any usage limits or rate limiting on AI API calls per user? The verification loop (up to 3 extra calls per prompt) could get expensive. Should users be warned about token costs or have a configurable max token budget?

12. **Offline support scope:** Yjs supports offline editing natively. Should the app explicitly support offline mode (with visible indicator, queue of unsynced changes, etc.), or is it acceptable to require an active connection?
