# AI-Powered Collaborative Rich Text Editor — Project Plan

## 1. Overview

A real-time collaborative rich text editor built with **Next.js 16** (App Router) and **Convex** (database, file storage, backend functions, auth). The app features a dual-pane layout: a rich text editing panel on the left and an AI assistant chat panel on the right. Documents are stored as ProseMirror JSON (the editor's native format), with no markdown layer. AI communication uses HTML serialization. The app supports granular versioning, real-time collaborative editing, comments, and AI-assisted writing via leading LLM providers.

### Key Architectural Decision: No Markdown

The app stores and operates on **ProseMirror's native JSON document model** as the single source of truth. There is no raw markdown mode and no markdown ↔ ProseMirror conversion layer. This decision was made because:

1. **Consumer-first UX** — Target users expect a Google Docs-like rich text experience, not a markdown editing experience.
2. **No roundtrip fidelity issues** — ProseMirror JSON is lossless. What the user sees is exactly what's stored.
3. **Simplified collaboration** — `@convex-dev/prosemirror-sync` syncs the ProseMirror document directly via OT. No translation layer between the collaborative state and the editor.
4. **Simplified AI integration** — The document is serialized to HTML for AI context, and AI HTML responses are parsed back to ProseMirror. HTML maps more directly to ProseMirror's node model than markdown does, and normalization in the HTML→ProseMirror direction is invisible to users (they only see the rendered view).
5. **Export is one-way** — Users can export as markdown, HTML, or PDF via a download button. Since it's a one-way operation, formatting normalization is irrelevant.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| React | React 19 |
| Backend / DB / Auth / Storage | Convex |
| Auth Provider | Google OAuth (via Convex Auth) |
| Rich Text Editor | Tiptap 3.x (ProseMirror-based) |
| Real-time Collaboration | `@convex-dev/prosemirror-sync` (OT-based, via Tiptap extension) |
| Presence | Convex Presence (reactive queries + heartbeats, via `convex-presence` pattern) |
| AI Providers | OpenAI, Anthropic, Google (Gemini) |
| Styling | Tailwind CSS 4 + shadcn/ui |
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

### 3.3 Real-Time Collaboration: `@convex-dev/prosemirror-sync`

- Use **`@convex-dev/prosemirror-sync`** — Convex's official ProseMirror sync component — for conflict-free collaborative editing.
- The component uses **operational transformations (OT)** to safely merge concurrent edits between clients. No Yjs or CRDTs needed.
- Integration is via a **Tiptap extension** and a `useTiptapSync` React hook. Edits are synced automatically through Convex's reactive subscription system.
- The component manages its own internal tables (steps + snapshots) within the Convex database. **Debounced snapshots** allow new clients to load the document without replaying the full step history.
- **Server-side document transformation** is supported via `prosemirrorSync.transform()`, enabling AI edits to be applied directly on the server and synced to all clients.
- **Server-side authorization** hooks allow reads, writes, and snapshots to be gated by document permissions.
- Presence (cursors, selections, usernames) is handled separately via the **Convex presence pattern** (reactive queries + heartbeats), stored in a `presence` table.

### 3.4 AI Edit Flow: Server-Side Transform with HTML Serialization

The AI reads and writes **HTML**, not ProseMirror JSON or markdown. With `@convex-dev/prosemirror-sync`, AI edits can be applied **server-side** using the `transform()` API, which is a major simplification over client-side orchestration.

**The flow:**

```
1. Client sends user prompt + document ID to Convex action
                         │
2. Convex action fetches current doc via prosemirrorSync.getDoc()
                         │
3. Serialize doc to HTML (via linkedom DOM) → send to LLM
                         │
4. LLM returns edited HTML
                         │
5. Parse response HTML → build new ProseMirror doc (via linkedom DOM)
   → compute minimal Transform via prosemirror-recreate-steps
   → apply via prosemirrorSync.transform() as OT steps
                         │
6. All clients receive changes automatically via prosemirror-sync ✓
```

**Server-side DOM requirement:** ProseMirror's `DOMSerializer` and `DOMParser` require a DOM environment. Convex actions run in serverless Node.js with no browser DOM. We use **`linkedom`** to provide a lightweight DOM implementation. This is used in two places: (1) serializing the current ProseMirror doc to HTML for the LLM, and (2) parsing the LLM's response HTML back into a ProseMirror document. See `lib/editor/serverDom.ts` for the helper.

**Why HTML over markdown for AI:**
- ProseMirror has lossless, built-in HTML serialization (`DOMSerializer`) and parsing (`DOMParser`).
- HTML maps more directly to ProseMirror's node types (paragraphs, headings, lists, tables, etc.) than markdown does.
- LLMs are highly capable at reading and writing HTML.
- No markdown normalization concerns — what the LLM returns is exactly what the user sees.

**Why this doesn't cause flicker:**
- AI changes are computed as **minimal** ProseMirror `Transform` steps using `prosemirror-recreate-steps`, which diffs the old and new documents and produces the smallest possible set of steps. These are applied via `prosemirrorSync.transform()`, not via `setContent`.
- Because the steps are minimal (only touching changed regions), **cursors, selections, and scroll positions outside the changed region are preserved** for all collaborators. A full-document `replaceWith` would destroy all cursor positions — `prosemirror-recreate-steps` avoids this.
- The OT layer in `prosemirror-sync` handles conflict resolution if a user is editing concurrently.
- Changes propagate to all clients as normal collaborative edit steps.

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
    // Global per-user settings (UI preferences, not document properties)
    settings: v.optional(v.object({
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
      defaultModel: v.optional(v.string()),    // e.g. "gpt-4o", "claude-sonnet-4-20250514"
      editorFontSize: v.optional(v.number()),  // display zoom, e.g. 16
      editorLineSpacing: v.optional(v.number()), // e.g. 1.5
    })),
    // Convex auth fields are managed automatically
  }).index("by_email", ["email"]),

  // --- Documents ---
  // Note: The prosemirror-sync component manages its own internal tables
  // (steps + snapshots) for real-time sync. This table stores metadata
  // and a cached content snapshot for AI context, search, and versioning.
  documents: defineTable({
    title: v.string(),
    content: v.string(),              // ProseMirror JSON (stringified) — cached snapshot
    lastDiffAt: v.optional(v.number()), // timestamp of last idle-save diff (for server-side dedup)
    chatClearedAt: v.optional(v.number()), // timestamp when chat was last cleared; messages before this are hidden in UI and excluded from AI context
    aiLockedBy: v.optional(v.id("users")),  // user ID of who has an active AI request; null when idle
    aiLockedAt: v.optional(v.number()),     // timestamp when the AI lock was acquired (for stale lock detection)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_updatedAt", ["updatedAt"]),

  // --- Presence ---
  // Ephemeral presence data (cursors, selections, online status).
  // Uses the Convex presence pattern with heartbeats for cleanup.
  presence: defineTable({
    documentId: v.id("documents"),
    visitorId: v.string(),            // unique per-session identifier
    userId: v.id("users"),
    data: v.any(),                    // { cursor: number, selection: { from, to }, color: string, name: string }
    updatedAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_visitor", ["visitorId"]),

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
    lastRemapVersion: v.optional(v.number()), // prosemirror-sync version at which positions were last remapped
    orphaned: v.optional(v.boolean()),  // true if anchor text was deleted and comment can't be positioned
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
    createdAt: v.number(),
  }).index("by_document", ["documentId"]),
});
```

### 4.1 Notes on the Schema

**Why `content` is a stringified JSON, not a Convex object:** ProseMirror JSON is deeply nested with variable structure (different node types, optional attrs, variable-length content arrays). Storing it as a string avoids fighting Convex's type system for a structure that is better validated by ProseMirror itself.

**Why `snapshotAfter` in diffs:** Every diff record includes a full ProseMirror JSON snapshot of the document after the change. This allows any version to be restored without replaying the entire diff chain. Storage cost is acceptable for text documents.

**Why `lastDiffAt` on documents:** Used for server-side deduplication of idle-save diffs. When multiple collaborators are editing the same document, each client independently fires a 5-second idle timer and calls `triggerIdleSave`. The mutation checks `lastDiffAt` — if a diff was already saved within the last 4 seconds, it skips. Because Convex mutations are transactionally serialized, concurrent triggers are naturally ordered and only one produces a diff per edit window. See section 5.3 for the full flow.

**Comment anchoring:** Comments use ProseMirror positions (`anchorFrom`, `anchorTo`) which are stable within a document version. For collaborative editing, ProseMirror's mapping capabilities (via the steps stored by `prosemirror-sync`) can be used to remap comment positions as the document changes. The `anchorText` field is a fallback for re-anchoring if positions drift.

**Presence table:** Presence is stored in a `presence` table using the Convex presence pattern. Heartbeats (default 5-second interval) keep entries fresh. Stale entries (no update in 10+ seconds) are considered offline and filtered out client-side. The `data` field is schemaless (`v.any()`) to allow flexible presence payloads (cursor position, selection range, user color, etc.).

**prosemirror-sync internal tables:** The `@convex-dev/prosemirror-sync` component manages its own tables (steps and snapshots) via the Convex component system. These are separate from the app schema and do not need to be defined manually.

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
- Real-time collaboration via `@convex-dev/prosemirror-sync` Tiptap extension (OT-based sync through Convex).
- Collaborator cursors and selections rendered as colored overlays with name labels (via Convex presence).

#### Formatting Toolbar Design
- Fixed toolbar at the top of the editor panel (below the main app toolbar).
- Buttons are grouped logically: Text style | Headings | Lists | Insert (link, image, table, code block, blockquote, rule).
- Active formatting is visually indicated (e.g., bold button is highlighted when cursor is in bold text).
- Keyboard shortcuts for common formatting (Cmd/Ctrl+B, Cmd/Ctrl+I, etc.).

#### Idle-Save Diff (Server-Coordinated)

Idle-save diffs are **coordinated server-side** to prevent duplicate diffs when multiple collaborators are editing the same document. The client detects idleness; the server decides whether to actually save.

**Client side (`useIdleSave` hook):**
- A **5-second idle timer** resets after each local edit (via Tiptap's `onUpdate` callback).
- When the timer fires, the client calls a lightweight Convex mutation: `diffs.triggerIdleSave({ documentId })`.
- The client does **not** compute diffs, serialize HTML, or decide whether to save — that's all server-side.

**Server side (`diffs.triggerIdleSave` mutation):**
1. **Deduplicate:** Read the document's `lastDiffAt` timestamp. If a diff was already saved within the last 4 seconds, skip (another client's trigger already saved a diff for this edit window). This works because Convex mutations on the same document are serialized — concurrent triggers from multiple clients are processed one at a time, and the second one sees the `lastDiffAt` written by the first.
2. **Snapshot:** Fetch the current ProseMirror doc via `prosemirrorSync.getDoc()`. Serialize to HTML (via `linkedom`).
3. **Diff:** Load the last diff record's `snapshotAfter` for this document. Serialize it to HTML. Compute an HTML-level diff via `diff-match-patch`.
4. **Save (if changed):** If the diff is non-empty, store a new `diffs` record with `source: "manual"`. Update the document's `content` field (cached ProseMirror JSON), `updatedAt`, and `lastDiffAt` timestamps.
5. **Skip (if unchanged):** If the diff is empty (e.g., the user typed and then undid), update only `lastDiffAt` to prevent redundant retriggers.

**Why this is safe:**
- Convex mutations are **transactionally serialized** per-document. Even if 5 clients call `triggerIdleSave` at the same instant, they execute one at a time. The first writes `lastDiffAt`; the remaining 4 see the fresh timestamp and skip.
- The 4-second dedup window is slightly shorter than the 5-second idle timer, ensuring that a genuinely new edit window (where no one has typed for 5+ seconds) always produces a diff.
- No client-side coordination, locking, or leader election is needed.

Note: `prosemirror-sync` already handles its own debounced snapshots internally for sync purposes. The idle-save diff system is a separate concern — it creates version history records for the user-facing timeline.

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
┌──────────────────────────────────────────┐
│ Server-side (mutation):                  │
│ 1. Acquire AI lock on document           │
│    (set aiLockedBy + aiLockedAt).        │
│    If already locked by another user     │
│    (and lock is <120s old), reject with  │
│    "AI is busy" error.                   │
│ 2. All collaborators see the lock via    │
│    reactive query → UI shows             │
│    "AI (<username>) is working..."       │
└───────────┬──────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────┐
│ Server-side (HTTP action, streaming):    │
│ 1. Fetch doc via prosemirrorSync.getDoc()│
│ 2. Serialize to HTML                     │
│ 3. Build context (system prompt + HTML   │
│    + last 5 chat messages after         │
│      chatClearedAt                     │
│    + user prompt)                       │
│ 4. Stream response to client (chat UI)   │
│ 5. After stream completes:               │
│    - Parse response (extract HTML edits) │
│    - Apply via prosemirrorSync.transform()│
│    - Save diff record (source: "ai")     │
│    - Save AI message record              │
│    - Release AI lock (clear aiLockedBy)  │
└───────────┬──────────────────────────────┘
            │
            ▼
  All clients receive changes automatically
  via prosemirror-sync reactive subscriptions ✓
  Lock cleared → "AI is working..." disappears.
```

#### Applying AI Responses (Detailed)

**Step-by-step process (all server-side in a Convex action):**

1. **Fetch** the current ProseMirror document via `prosemirrorSync.getDoc(ctx, id, schema)`.
2. **Serialize** the document to HTML using ProseMirror's `DOMSerializer` with a `linkedom` DOM. (Convex actions run in serverless Node.js — there is no browser DOM. `linkedom` provides a lightweight DOM implementation for `DOMSerializer` and `DOMParser`.)
3. **Send** the HTML + user prompt + system prompt to the selected model.
4. **Parse** the model's response to extract the edited HTML (search/replace blocks or full HTML from a code fence).
5. **Build the new HTML** — For search/replace blocks: apply the string-level replacements to the serialized HTML. For full-doc responses: use the returned HTML as-is.
6. **Apply** the changes via `prosemirrorSync.transform(ctx, id, schema, (doc) => { ... })`:
   - Parse the new HTML into a ProseMirror document using ProseMirror's `DOMParser` (with `linkedom`).
   - Compute a **minimal set of steps** from the current `doc` to the new doc using **`prosemirror-recreate-steps`** (`recreateTransform(oldDoc, newDoc)`). This produces the smallest possible `Transform` — only the changed regions are touched, preserving collaborator cursors and selections outside those regions.
   - Return the Transform. The component applies it as OT steps and syncs to all clients.
7. **Save** a diff record with the HTML-level diff (for version history) and the new ProseMirror JSON snapshot.

> **Why `prosemirror-recreate-steps` is required (not optional):** Without it, the only way to go from doc A to doc B is `tr.replaceWith(0, doc.content.size, newDoc.content)` — a single step that replaces the entire document. ProseMirror maps all remote cursor/selection positions through each step; a full-document replace maps every position to the end of the document, destroying all collaborators' cursor positions. `prosemirror-recreate-steps` diffs the two documents structurally and produces granular steps (e.g., "replace characters 45-60", "insert node at position 120"), so positions outside the changed regions survive the mapping.

**Conflict handling:** If a user is editing concurrently, `prosemirrorSync.transform()` handles OT rebasing automatically. The callback may be re-invoked with an updated `doc` if the document changed between fetch and apply. The second argument to the callback provides the current version, which can be compared to detect concurrent changes.

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

- Each document has an **owner** — tracked via a `permissions` record with `role: "owner"`, created atomically when the document is created. There is no separate `ownerId` field on the documents table; ownership is determined solely from the `permissions` table. This avoids dual-source ambiguity.
- The owner can share with other users by email, assigning a role:
  - **Editor** — can edit, comment, and view.
  - **Commenter** — can comment and view.
  - **Viewer** — can only view.
- Permissions are checked server-side in every Convex mutation/query via a single lookup on the `permissions` table (using the `by_document_user` index). Owner checks also use this table — no need to join with the documents table.
- The Share modal shows current collaborators and their roles, with the ability to change roles or revoke access. The owner role cannot be revoked (the UI should prevent this).
- Shareable links: Generate a link containing the document ID. When a user opens the link, they are prompted to sign in if not already, and then granted viewer access (or the role specified by the owner).

### 5.7 Comments

- Users can select text in the editor and add a comment.
- Comments appear in a right-side margin or sidebar, anchored to the selected text with a connecting line/highlight.
- Threaded replies are supported (via `parentCommentId`).
- Comments can be resolved (hidden but not deleted).
- Real-time: Comments are stored in Convex and appear instantly for all collaborators via reactive queries.

**Comment anchor remapping strategy:**

Comments store ProseMirror positions (`anchorFrom`, `anchorTo`) and a fallback `anchorText` (the highlighted text at creation time). Positions drift as the document is edited. The remapping strategy:

1. **On each idle-save diff:** The `triggerIdleSave` mutation already fetches the current doc and computes diffs. After saving a diff, it also remaps all active (unresolved) comments for that document. For each comment, map `anchorFrom` and `anchorTo` through the ProseMirror steps accumulated since the comment was last remapped (tracked via a `lastRemapVersion` field on each comment, compared against the prosemirror-sync version). Update the stored positions in-place.

2. **On AI edits:** The `submitPrompt` action already applies a Transform via `prosemirrorSync.transform()`. After applying, remap all active comments through the same Transform steps. This happens in the same server-side flow.

3. **Text fallback:** After remapping, verify that the text at the new `anchorFrom..anchorTo` range matches `anchorText`. If it doesn't (position drifted into different content), fall back to a text search: scan the document for `anchorText` and re-anchor to the first match. If no match is found (text was deleted), mark the comment as orphaned (still visible in the sidebar but without a highlight in the editor).

4. **Client-side rendering:** The client reads the stored positions and renders highlights. No client-side remapping — the server keeps positions up to date.

This keeps remapping batched (not per-keystroke) and server-authoritative. The worst-case staleness is ~5 seconds (one idle-save cycle).

### 5.8 Presence

- Each user's cursor position, selection range, and name/color are broadcast to all collaborators viewing the same document.
- Implemented via the **Convex presence pattern**: a `presence` table with periodic heartbeats (5-second interval) and single-flighted updates for back-pressure under load.
- A `usePresence` hook provides a `useState`-like API: `[myPresence, othersPresence, updateMyPresence]`.
- Cursors and selections are rendered as colored overlays in the Tiptap editor, with a small name label next to each remote cursor.
- Stale presence entries (no update in 10+ seconds) are considered offline and filtered out client-side.
- **Server-side cleanup:** A Convex cron job runs every 60 seconds and deletes all presence records with `updatedAt` older than 60 seconds. This prevents the `presence` table from accumulating dead records over time. The 60-second threshold is deliberately conservative (6× the heartbeat interval) to avoid deleting entries during transient network hiccups — client-side filtering at 10 seconds handles the fast "offline" detection, while the cron handles garbage collection.
- Presence updates are throttled via single-flighting: only the latest update is sent, skipping intermediate states. This provides graceful degradation as the number of concurrent users increases.

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
│   │   └── RemoteCursors.tsx       # Renders remote user cursors/selections via presence data
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
│   ├── convex.config.ts          # Convex app config (installs prosemirror-sync component)
│   ├── auth.ts                   # Auth configuration (Google OAuth)
│   ├── users.ts                  # User queries/mutations
│   ├── documents.ts              # Document CRUD, permissions checks
│   ├── prosemirrorSync.ts        # prosemirror-sync API (exposes sync endpoints with auth)
│   ├── presence.ts               # Presence mutations/queries (cursor, selection, heartbeat, cleanup)
│   ├── crons.ts                  # Convex cron jobs (presence cleanup every 60s)
│   ├── diffs.ts                  # Diff storage, version history
│   ├── comments.ts               # Comment CRUD
│   ├── permissions.ts            # Permission management
│   ├── ai.ts                     # AI actions (model calls + server-side doc transform)
│   └── _generated/               # Convex generated files
│
├── lib/
│   ├── ai/
│   │   ├── prompts.ts            # System prompts, templates
│   │   ├── models.ts             # Model definitions and config
│   │   └── parseResponse.ts      # Parse search/replace or full-doc HTML responses
│   ├── editor/
│   │   ├── extensions.ts         # Tiptap extension configuration
│   │   ├── serverDom.ts          # linkedom DOM helper for server-side ProseMirror HTML serialization/parsing
│   │   ├── serverHtml.ts         # Server-side doc→HTML and HTML→doc using serverDom + ProseMirror
│   │   └── diffing.ts            # HTML diff computation for version history
│   ├── permissions.ts            # Permission checking utilities
│   └── utils.ts                  # General utilities
│
├── hooks/
│   ├── useIdleSave.ts            # 5-second idle timer → calls server-side triggerIdleSave mutation
│   ├── useAIChat.ts              # AI chat interaction logic
│   ├── usePresence.ts            # Presence hook (cursor, selection, heartbeat)
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
| `create` | mutation | Create a new document (title, empty ProseMirror JSON). Atomically inserts a `permissions` record with `role: "owner"` for the creating user. Also calls `prosemirrorSync.create()` to initialize the sync document. |
| `get` | query | Get a document by ID (with permission check). |
| `list` | query | List documents accessible to the current user. Queries the `permissions` table by `userId` (via `by_user` index), then fetches the corresponding documents. |
| `updateContent` | mutation | Update cached document ProseMirror JSON and `updatedAt` (with editor permission check). Called by idle-save. |
| `delete` | mutation | Delete a document (owner only). Also cleans up prosemirror-sync data. |

### 7.2a ProseMirror Sync (`convex/prosemirrorSync.ts`)

Exposes the `@convex-dev/prosemirror-sync` API with authorization hooks:

```typescript
const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
export const { getSnapshot, submitSnapshot, latestVersion, getSteps, submitSteps } =
  prosemirrorSync.syncApi({
    // Authorization: check that the user has at least viewer access
    // for reads, and editor access for writes
  });
```

### 7.2b Presence (`convex/presence.ts`)

| Function | Type | Description |
|---|---|---|
| `update` | mutation | Upsert presence data (cursor, selection, color, name) for a user in a document room. Also serves as heartbeat. |
| `heartbeat` | mutation | Touch the `updatedAt` timestamp without changing data. |
| `list` | query | List all presence entries for a document. Clients filter stale entries (>10s old). |
| `remove` | mutation | Remove presence entry on disconnect/navigation away. |
| `cleanup` | mutation | Called by a cron job every 60 seconds. Deletes all presence records with `updatedAt` older than 60 seconds. Prevents stale records from accumulating. |

### 7.3 Diffs (`convex/diffs.ts`)

| Function | Type | Description |
|---|---|---|
| `triggerIdleSave` | mutation | Server-coordinated idle save. Deduplicates via `lastDiffAt` (skips if a diff was saved within the last 4s). If enough time has passed: fetches the current doc via `prosemirrorSync.getDoc()`, serializes to HTML (via `linkedom`), computes an HTML diff against the last snapshot, and saves a new diff record with `source: "manual"` if changes are detected. Updates the document's `content`, `updatedAt`, and `lastDiffAt`. |
| `create` | mutation | Store a new diff record (with ProseMirror JSON snapshot). Used internally by `triggerIdleSave` and AI edit flow. |
| `listByDocument` | query | List all diffs for a document, ordered by time. |
| `getVersion` | query | Get a specific version's ProseMirror JSON snapshot. |
| `restore` | mutation | Restore a document to a specific version (replaces content, creates a new diff). |

### 7.4 AI (`convex/ai.ts`)

| Function | Type | Description |
|---|---|---|
| `acquireLock` | mutation | Acquire the AI lock on a document. Sets `aiLockedBy` + `aiLockedAt` if the document is unlocked (or the existing lock is stale >120s). Rejects if another user holds a fresh lock. |
| `releaseLock` | mutation | Release the AI lock. Clears `aiLockedBy` and `aiLockedAt`. Called after the AI action completes (success or error). |
| `submitPrompt` | HTTP action | Main AI flow (streaming): fetch doc, serialize to HTML, call LLM with streaming, pipe tokens to response, parse buffered response, apply changes via `prosemirrorSync.transform()`, save diff and message records, release lock. |
| `callModel` | (internal) | Call the appropriate AI provider API based on model selection. |
| `saveMessage` | mutation | Store an AI chat message. |
| `getMessages` | query | Get chat history for a document. |

> **Note:** `submitPrompt` is a Convex **action** (not a mutation) because it makes external HTTP calls to AI APIs. It calls mutations internally to save messages. With `@convex-dev/prosemirror-sync`, the AI edit flow is now **server-side**: the action fetches the current document via `prosemirrorSync.getDoc()`, sends it to the LLM, and applies the response via `prosemirrorSync.transform()`. No client-side ProseMirror instance is needed for applying AI edits.

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
- Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

### 8.2 System Prompt (Draft)

````
You are an AI writing assistant helping edit a rich text document collaboratively. Multiple users may be working on this document. Each message in the conversation is prefixed with the user's name (e.g., "[Alice]: fix the grammar"). Pay attention to who is asking — different users may have different requests.

The document is provided as HTML.

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
````

### 8.3 Model Calling

Use the official SDKs for each provider within Convex actions:
- `openai` npm package for OpenAI models
- `@anthropic-ai/sdk` for Anthropic models
- `@google/genai` for Gemini models

Each model call should:
1. Track token usage (for potential future billing/limits).
2. Stream responses where possible for better UX.
3. Handle rate limits with exponential backoff.
4. Set reasonable timeouts (60s).

### 8.4 Streaming Responses

AI responses stream to the client for real-time UX, then document changes are applied as a batch after streaming completes.

**Architecture:** The flow uses two Convex entry points — an HTTP streaming endpoint and an internal action:

```
Client                          Convex
  │                               │
  │  POST /ai/stream              │
  │  {documentId, prompt, model}  │
  │──────────────────────────────→│
  │                               │  HTTP action:
  │                               │  1. Fetch doc, serialize to HTML
  │                               │  2. Build context
  │                               │  3. Call LLM with streaming
  │  ← streaming tokens ─────────│  4. Stream tokens to response body
  │  (client renders in chat)     │     while buffering full response
  │                               │  5. After stream ends:
  │                               │     - Parse buffered response
  │                               │     - Apply transform (prosemirrorSync.transform)
  │                               │     - Save diff + AI message records
  │  ← prosemirror-sync sub ─────│  6. All clients receive doc changes
  │  (editor updates via OT)      │     via reactive subscriptions
  │                               │
```

**Details:**
- The HTTP action creates a `ReadableStream` that pipes LLM tokens to the client as they arrive. The client consumes this via `fetch` with `getReader()` and renders tokens in the chat panel.
- Simultaneously, the action buffers the full response in memory. When the stream completes, it parses the response (search/replace blocks or full HTML), applies the document transform, and saves records — all within the same action invocation.
- The client does **not** need to signal "stream complete" — the server knows when the LLM stream ends and handles everything after that point autonomously.
- Document changes arrive at all clients via `prosemirror-sync`'s reactive subscriptions, independent of the streaming response. The chat panel shows a "changes applied" indicator when it detects a new diff record linked to the AI message (via `diffId`).
- If the LLM call fails or times out, the HTTP action returns an error chunk in the stream and does not apply any document changes.

### 8.5 Server-Side AI Orchestration

The AI flow is orchestrated **server-side** via a lock-acquire mutation followed by a streaming HTTP action:

**Step 0 — Acquire lock (mutation, called before the HTTP action):**
The client calls an `ai.acquireLock({ documentId })` mutation. This checks the document's `aiLockedBy` field:
- If `null` (or the existing lock is stale — `aiLockedAt` > 120 seconds ago): set `aiLockedBy` to the current user's ID and `aiLockedAt` to now. Return success.
- If locked by another user (and lock is fresh): reject with an "AI is already processing a request from \<username\>" error. The client shows this to the user.
- All collaborators see `aiLockedBy` via a reactive query on the document → the UI shows "AI (\<username\>) is working..." automatically.

**Steps 1–8 — Streaming HTTP action (`POST /ai/stream`):**

1. Client calls the HTTP streaming endpoint with the document ID, user prompt, and selected model.
2. The action fetches the current document via `prosemirrorSync.getDoc()` and serializes it to HTML using ProseMirror's `DOMSerializer` with a **`linkedom`** DOM (Convex actions have no browser DOM — `linkedom` provides a lightweight server-side DOM for ProseMirror's HTML serialization and parsing; see `lib/editor/serverDom.ts`).
3. The action builds context: system prompt + document HTML + last 5 chat messages after `chatClearedAt` (for conversational continuity) + user prompt. Filtering: query `aiMessages` by `documentId`, ordered by `createdAt`, then filter out any messages with `createdAt < document.chatClearedAt` (these are "cleared" — hidden from UI and excluded from AI context). Each user message in the chat history is prefixed with the sender's name (e.g., `[Alice]: fix the grammar`) so the model can distinguish requests from different collaborators. Before submitting, check total token count — drop oldest chat history messages first if needed to fit the model's context window (document + system prompt + user prompt always take priority).
4. The action calls the user's selected model with streaming. Tokens are piped to the HTTP response body while simultaneously buffered in memory.
5. After the stream completes, the action parses the buffered response (search/replace blocks or full HTML) and builds the new HTML string.
6. The action applies changes via `prosemirrorSync.transform()`: inside the callback, parse the new HTML into a ProseMirror doc (via `DOMParser` + `linkedom`), then compute a **minimal Transform** using **`prosemirror-recreate-steps`** (`recreateTransform(currentDoc, newDoc)`). This produces granular steps that only touch changed regions, preserving all collaborator cursors and selections outside those regions. The component applies the steps via OT and syncs to all clients.
7. The action saves the diff record and AI message record via mutations.
8. The action **releases the lock** by clearing `aiLockedBy` and `aiLockedAt` on the document. (Also released in error/timeout paths to prevent stuck locks. The 120-second stale lock timeout is a safety net for cases where the action crashes without cleanup.)

This is a major simplification over client-side orchestration: no ProseMirror instance is needed on the client for AI edits, the entire flow is a single action call, and the client simply receives the changes as normal collaborative edits via the sync extension.

**Client role:** The `useAIChat` hook on the client calls `acquireLock`, then the streaming HTTP endpoint, and renders tokens in the chat panel as they arrive. Document changes arrive via `prosemirror-sync` reactive subscriptions. The "AI is working..." indicator is driven by the document's `aiLockedBy` field (reactive query), not by client-side state — so it's automatically visible to all collaborators and automatically clears when the lock is released.

---

## 9. Real-Time Sync + Presence Integration

### 9.1 `@convex-dev/prosemirror-sync` Setup

The collaborative editing layer uses Convex's official ProseMirror sync component, which handles all the complexity of multi-client document synchronization.

**Architecture:**

```
Client A (Tiptap + sync ext)  ←──→  Convex  ←──→  Client B (Tiptap + sync ext)
                                       │
                              ┌────────┴─────────┐
                              │ prosemirror-sync  │
                              │  internal tables: │
                              │  - steps          │
                              │  - snapshots      │
                              ├──────────────────-┤
                              │  app tables:      │
                              │  - documents      │
                              │  - presence       │
                              └──────────────────-┘
```

**Setup steps:**

1. Install: `npm install @convex-dev/prosemirror-sync`
2. Register the component in `convex/convex.config.ts`:
   ```typescript
   import { defineApp } from "convex/server";
   import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";
   const app = defineApp();
   app.use(prosemirrorSync);
   export default app;
   ```
3. Expose the sync API in `convex/prosemirrorSync.ts` with authorization hooks.
4. Use the `useTiptapSync` hook in the editor component:
   ```tsx
   const sync = useTiptapSync(api.prosemirrorSync, documentId);
   // sync.extension → add to Tiptap extensions
   // sync.initialContent → set as editor content
   // sync.isLoading → show loading state
   // sync.create(content) → create new document
   ```

### 9.2 Sync Protocol (Handled by the Component)

1. **On document open:** The `useTiptapSync` hook fetches the latest snapshot and any subsequent steps from the component's internal tables. The Tiptap editor is initialized with this content plus the sync extension.
2. **On local edit:** The sync extension captures ProseMirror steps and submits them to Convex via the exposed `submitSteps` mutation.
3. **On remote edit:** Convex reactive subscriptions push new steps to all connected clients. The sync extension applies them as ProseMirror transactions automatically.
4. **Debounced snapshots:** The component periodically writes a snapshot of the full document state so new clients don't need to replay the entire step history.
5. **Server-side transforms:** AI edits are applied via `prosemirrorSync.transform()`, which creates steps that are synced to all clients like any other edit.

### 9.3 Convex Presence

Presence is handled separately from document sync using the Convex presence pattern.

**Implementation:**

1. A `presence` table stores ephemeral data (cursor position, selection range, user name, color) per user per document.
2. A `usePresence` hook on the client:
   - Sends presence updates (cursor/selection changes) via single-flighted mutations.
   - Subscribes to presence data for the current document room via a reactive query.
   - Sends periodic heartbeats (every 5 seconds) to signal the user is still online.
3. Remote cursors and selections are rendered as colored overlays in the Tiptap editor using a custom Tiptap extension or a decoration plugin.
4. Stale entries (>10s since last update) are filtered out client-side.

**Performance considerations:**
- **Single-flighting** ensures that rapid cursor movements don't flood the server — only the latest update is sent, and intermediate positions are skipped.
- **Cache efficiency:** Convex caches query results by function arguments. The presence query for a given document is recomputed once per room per update, not once per user — so the cost scales linearly, not quadratically, with the number of collaborators.
- **Cursor rendering:** Remote cursor positions may be slightly behind (50-200ms) due to network latency. A CSS transition can smooth the visual movement.

### 9.4 Considerations

- **Latency:** Convex reactive queries typically deliver updates in ~50-100ms, which is acceptable for collaborative editing.
- **Conflict resolution:** Handled entirely by OT within `prosemirror-sync` — no manual merge logic needed.
- **Offline support:** v1 is online-only. If the user goes offline, show a "disconnected" banner. No local caching or offline editing. `prosemirror-sync` supports offline document creation, and full offline editing is a planned future feature of the component — revisit when available.
- **Scalability:** The component uses incremental step syncing and debounced snapshots. Old steps and snapshots can be cleaned up via the deletion API.

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
1. Initialize Next.js 16 project with Tailwind CSS 4, shadcn/ui.
2. Set up Convex project and schema.
3. Implement Google OAuth with Convex Auth.
4. Create basic layout (toolbar, 2/3 + 1/3 split).
5. Implement New Doc and Open Doc modals with basic CRUD.

### Phase 2: Editor
1. Integrate Tiptap with formatting toolbar.
2. Configure Tiptap extensions (StarterKit, underline, task lists, tables, links, images, code blocks).
3. Implement document loading: fetch ProseMirror JSON from Convex, load into Tiptap.
4. Implement document saving: serialize ProseMirror JSON, save to Convex.
5. Implement idle-save: client-side `useIdleSave` hook (5s debounce → calls `triggerIdleSave` mutation) + server-side deduplication and diff computation.

### Phase 3: AI Assistant
1. Build AI chat panel UI (messages, input, model selector).
2. Implement Convex actions for calling OpenAI, Anthropic, Google APIs.
3. Implement prompt building (system prompt + HTML serialized document + user prompt).
4. Implement response parsing (HTML search/replace blocks + full-HTML fallback).
5. Implement server-side change application via `prosemirrorSync.transform()` (parse response HTML → ProseMirror Transform → synced to all clients).
6. Add streaming support for AI responses in the chat panel.

### Phase 4: Collaboration
1. Install and configure `@convex-dev/prosemirror-sync` component (convex.config.ts, sync API with auth hooks).
2. Integrate `useTiptapSync` hook with the Tiptap editor for real-time collaborative editing.
3. Implement presence (cursors, selections, collaborator labels) via Convex presence pattern (`usePresence` hook + presence table).
4. Implement Share modal with permission management.
5. Add permission checks to all Convex functions (including prosemirror-sync authorization hooks).
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
    "next": "^16.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "convex": "^1.31.x",
    "@convex-dev/auth": "^0.0.x",
    "@convex-dev/prosemirror-sync": "^0.2.x",
    "@tiptap/react": "^3.x",
    "@tiptap/starter-kit": "^3.x",
    "@tiptap/extension-underline": "^3.x",
    "@tiptap/extension-task-list": "^3.x",
    "@tiptap/extension-task-item": "^3.x",
    "@tiptap/extension-table": "^3.x",
    "@tiptap/extension-link": "^3.x",
    "@tiptap/extension-image": "^3.x",
    "openai": "^6.x",
    "@anthropic-ai/sdk": "^0.72.x",
    "@google/genai": "^1.x",
    "prosemirror-recreate-steps": "^1.x",
    "linkedom": "^0.x",
    "diff-match-patch": "^1.x",
    "tailwindcss": "^4.x",
    "@radix-ui/react-dialog": "^1.x",
    "class-variance-authority": "^0.x",
    "lucide-react": "^0.x"
  }
}
```

**Packages added (for server-side AI edit flow):**
- `linkedom` — Lightweight server-side DOM implementation. Required because ProseMirror's `DOMSerializer` and `DOMParser` need a DOM environment, and Convex actions run in serverless Node.js with no browser DOM. Used for HTML serialization (doc → HTML for the LLM) and HTML parsing (LLM response → ProseMirror doc). Much lighter than `jsdom` (~50KB vs ~2MB).
- `prosemirror-recreate-steps` — Computes a minimal set of ProseMirror `Transform` steps to go from one document to another. Required for AI edits to preserve collaborator cursors and selections. Without it, the only option is a full-document `replaceWith`, which destroys all cursor positions.

**Packages removed (replaced by `@convex-dev/prosemirror-sync` + Convex presence pattern):**
- `yjs` — CRDT layer no longer needed; prosemirror-sync uses OT.
- `y-prosemirror` — ProseMirror ↔ Yjs binding no longer needed.
- `@tiptap/extension-collaboration` — Replaced by prosemirror-sync's Tiptap extension.
- `@tiptap/extension-collaboration-cursor` — Replaced by Convex presence + custom cursor rendering.

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `prosemirror-sync` component limitations | Medium | The component is relatively new (v0.2.x). Monitor for edge cases in OT merging. The component is open-source and maintained by the Convex team, so issues can be reported and patched. |
| `prosemirror-recreate-steps` step quality | Low | The library heuristically diffs two ProseMirror documents to produce minimal steps. For complex structural changes (e.g., paragraphs → table), the steps may not be perfectly minimal, but they will be correct. In the worst case, it degrades to a full-content replace — same as not using it at all. |
| `linkedom` compatibility with ProseMirror | Low | `linkedom` is a lightweight DOM and may not implement every DOM API. ProseMirror's `DOMSerializer` and `DOMParser` use a limited subset (`createElement`, `createTextNode`, `appendChild`, etc.) that `linkedom` supports. If edge cases arise, `jsdom` is a drop-in replacement (heavier but more complete). |
| AI models returning unparseable HTML | Medium | Implement robust parsing with fallback to full-doc replacement. Validate HTML structure before applying. Add retry logic. |
| Server-side `transform()` callback re-invocation | Medium | The `transform()` callback may be re-invoked if the document changes concurrently. Ensure the callback is idempotent and doesn't perform slow operations internally (do AI calls beforehand, only build the Transform in the callback). |
| Document too large for AI context | Medium | Defer to large-context models (Gemini 2.5 Pro). Implement truncation warning. |
| ProseMirror JSON size in database | Low | ProseMirror JSON is ~2-3x larger than raw text, but well within Convex's 1 MB limit for any reasonable document. Monitor and warn for extreme cases. |
| Comment anchor drift during concurrent edits | Medium | Use ProseMirror step mapping to remap positions. Store `anchorText` as fallback for re-anchoring if positions drift. |
| HTML injection / XSS from AI responses | Medium | ProseMirror's DOMParser sanitizes HTML by only allowing known node/mark types. Untrusted HTML tags are stripped. Validate responses before applying. |
| Presence scalability with many collaborators | Low | Single-flighted mutations + Convex query caching (per-room, not per-user) keeps costs linear. Throttle presence updates if needed. |

---

## 14. Important Questions

> **Question 1 (Markdown fidelity / editor approach) — RESOLVED:** Using pure ProseMirror/Tiptap with ProseMirror JSON as the storage format. No markdown. HTML serialization for AI communication. No raw editing mode.

> **Question 2 (AI response streaming UX) — RESOLVED:** Hybrid approach. Stream the AI's text response live in the chat panel (so users see progress in real time), but apply document changes as a batch after the full response is received and parsed. This avoids broken document states from partial/malformed HTML mid-stream — especially important for structural changes (e.g., reformatting paragraphs into lists or tables) where there is no valid intermediate ProseMirror document state.

> **Question 3 (Conflict between AI edits and concurrent human edits) — RESOLVED:** Soft lock. While the AI is generating a response, show a visual indicator to all collaborators: "AI (\<username\>) is working..." (where \<username\> is the user who submitted the prompt). Users can still type, but the indicator nudges them to avoid major edits. The AI's response was based on a document snapshot taken at prompt submission — if the document changes significantly during generation, search/replace blocks may fail to match. In that case, show an error with a retry option. For the actual application of edits, `prosemirrorSync.transform()` handles OT rebasing automatically, and the apply step is near-instant so conflicts during application are negligible.

> **Question 4 (Verification loop oscillation) — DEFERRED TO V2:** Verification loop cut from v1 for simplicity. Users can re-prompt if the AI's output needs correction. See "Potential V2 Ideas" section.

> **Question 5 (Per-user settings scope) — RESOLVED:** Global per-user. Settings (theme, default AI model, editor display preferences like zoom/line spacing) are user-level UI preferences, not document properties. Document formatting is embedded in the ProseMirror JSON and is inherently per-document. No need for per-document settings overrides.

> **Question 6 (Document title management) — RESOLVED:** Both. A separate editable title field (stored in `documents.title`) is the primary title. If the user hasn't set one, fall back to the first H1 in the document, then "Untitled".

> **Question 7 (AI chat history persistence) — RESOLVED:** Chat history is stored permanently in the database (never deleted server-side). In the chat UI, history is persistent across sessions but any collaborator can clear the chat for a document, which sets `chatClearedAt` on the `documents` record to the current timestamp. This is a single field update (not a mass-update of every message). Clearing is global — it affects all collaborators and resets the AI's conversational memory. Messages with `createdAt < chatClearedAt` are hidden in the UI and excluded from model context. For AI context, include the last 5 messages after `chatClearedAt` as conversation history so the model can reference prior instructions. Before submitting, check total token count against the model's context limit — drop oldest historical messages first if needed to fit within the window (document HTML + system prompt + user prompt always take priority over chat history).

> **Question 8 (Real-time presence performance) — RESOLVED:** Design for small teams (~10 concurrent collaborators) for v1. No extra throttling beyond the existing single-flighted mutations and per-room query caching. Optimize for larger groups later if needed.

> **Question 9 (Shareable links — public access) — RESOLVED:** Auth required. All users must sign in with Google to access a shared document. No anonymous/public "anyone with the link" access for v1. Simpler and more secure.

> **Question 10 (Cost management for AI calls) — RESOLVED:** No usage limits or rate limiting for v1. Revisit limits if cost becomes a problem.

> **Question 11 (Offline support scope) — RESOLVED:** Online only for v1. Require an active connection. If the user goes offline, show a "disconnected" banner. No local caching or offline editing. Revisit when `prosemirror-sync` ships full offline support.

---

## 15. Potential V2 Ideas

### AI Verification Loop
After the initial AI edit, automatically run a verification loop (up to 3 iterations) using a cheap/fast model (e.g., Gemini Flash) to check whether the change was implemented correctly and completely. The verification model re-reads the updated document and either confirms it's correct ("OK") or makes additional corrections using the same edit format. Includes oscillation detection: if a verification round reverses the previous round's changes (i.e., the model is alternating between two states), stop early and keep the version from before the oscillation began. This reduces the need for users to re-prompt for minor issues, at the cost of additional latency and API calls per edit.
