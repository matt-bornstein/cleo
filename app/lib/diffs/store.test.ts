import {
  createDocument,
  getDocumentById,
  resetDocumentsForTests,
  setDocumentLastDiffAt,
  updateDocumentContent,
} from "@/lib/documents/store";
import {
  createDiff,
  ensureCreatedDiff,
  listDiffsByDocument,
  resetDiffsForTests,
  restoreVersion,
  triggerIdleSave,
} from "@/lib/diffs/store";
import * as aiModels from "@/lib/ai/models";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { vi } from "vitest";

function safeClearLocalStorage() {
  try {
    window.localStorage.clear();
  } catch {
    return;
  }
}

describe("diff store triggerIdleSave", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    if (localStorageDescriptor) {
      Object.defineProperty(window, "localStorage", localStorageDescriptor);
    }
    resetDocumentsForTests();
    resetDiffsForTests();
    safeClearLocalStorage();
  });

  it("skips when there are no changes", () => {
    const document = createDocument("No change doc");

    const result = triggerIdleSave({
      documentId: document.id,
      snapshot: document.content,
    });

    expect(result).toEqual({
      skipped: true,
      reason: "no_change",
    });
  });

  it("writes diff for changed snapshot and dedups near-immediate retries", () => {
    const document = createDocument("Changed doc");
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });

    const first = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
    });
    expect(first.skipped).toBe(false);

    const immediateRetry = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
    });
    expect(immediateRetry).toEqual({
      skipped: true,
      reason: "dedup_window",
    });

    const diffs = listDiffsByDocument(document.id);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].snapshotAfter).toBe(changedSnapshot);
    expect(getDocumentById(document.id)?.content).toBe(changedSnapshot);
  });

  it("floors diff createdAt timestamps at zero for negative clocks", () => {
    const document = createDocument("Diff clock floor");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);
    const diff = createDiff({
      documentId: document.id,
      userId: "u-1",
      snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
      source: "manual",
    });

    expect(diff).not.toBeNull();
    expect(diff?.createdAt).toBe(0);
    nowSpy.mockRestore();
  });

  it("falls back to zero timestamps when Date.now throws", () => {
    const document = createDocument("Throwing clock doc");
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now failed");
    });
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });

    expect(() =>
      createDiff({
        documentId: document.id,
        userId: "u-1",
        snapshotAfter: changedSnapshot,
        source: "manual",
      }),
    ).not.toThrow();
    const idleResult = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
    });
    expect(idleResult.skipped).toBe(true);
    expect(["no_change", "missing_document"]).toContain(idleResult.reason);

    nowSpy.mockRestore();
  });

  it("builds new diff patches from latest historical snapshot by timestamp", () => {
    const document = createDocument("Patch baseline doc");
    const legacySnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "legacy baseline marker" }] }],
    });
    const latestSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "latest baseline marker" }] }],
    });
    const nextSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "next baseline marker" }] }],
    });

    window.localStorage.setItem(
      "plan00.diffs.v1",
      JSON.stringify({
        diffs: [
          {
            id: "legacy",
            documentId: document.id,
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+legacy",
            snapshotAfter: legacySnapshot,
            source: "manual",
            createdAt: 1,
          },
          {
            id: "latest",
            documentId: document.id,
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+latest",
            snapshotAfter: latestSnapshot,
            source: "manual",
            createdAt: 2,
          },
        ],
      }),
    );

    const created = createDiff({
      documentId: document.id,
      userId: "u-1",
      snapshotAfter: nextSnapshot,
      source: "manual",
    });

    expect(created).not.toBeNull();
    expect(created?.patch).toContain("-lates");
    expect(created?.patch).not.toContain("legacy");
  });

  it("uses current document content as baseline when no prior diffs exist", () => {
    const document = createDocument("Document baseline fallback");
    const currentSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "current baseline marker" }] }],
    });
    const nextSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "next revision marker" }] }],
    });
    updateDocumentContent(document.id, currentSnapshot);

    const created = createDiff({
      documentId: document.id,
      userId: "u-1",
      snapshotAfter: nextSnapshot,
      source: "manual",
    });

    expect(created).not.toBeNull();
    expect(created?.patch).toContain("-cur");
  });

  it("falls back to default dedup window for malformed dedup values", () => {
    const document = createDocument("Changed doc");
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });

    const first = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: Number.NaN,
    });
    expect(first.skipped).toBe(false);

    const immediateRetry = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: Number.NaN,
    });
    expect(immediateRetry).toEqual({
      skipped: true,
      reason: "dedup_window",
    });
  });

  it("treats zero lastDiffAt as a valid dedup boundary", () => {
    const document = createDocument("Zero timestamp dedup doc");
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });
    setDocumentLastDiffAt(document.id, 0);

    const result = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: Number.MAX_SAFE_INTEGER,
    });

    expect(result).toEqual({
      skipped: true,
      reason: "dedup_window",
    });
  });

  it("creates an initial created diff and restores historical snapshot", () => {
    const document = createDocument("History doc");
    ensureCreatedDiff({
      documentId: document.id,
      snapshot: document.content,
    });

    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "New version" }] }],
    });
    triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: 0,
    });

    const restoreResult = restoreVersion({
      documentId: document.id,
      snapshot: document.content,
    });
    expect(restoreResult.restored).toBe(true);

    const diffs = listDiffsByDocument(document.id);
    expect(diffs.map((diff) => diff.source)).toContain("created");
    expect(getDocumentById(document.id)?.content).toBe(document.content);
  });

  it("ensures a created baseline diff exists even after manual history", () => {
    const document = createDocument("Backfill created diff");
    const changedSnapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "manual revision" }] }],
    });

    const manualDiff = triggerIdleSave({
      documentId: document.id,
      snapshot: changedSnapshot,
      dedupWindowMs: 0,
    });
    expect(manualDiff.skipped).toBe(false);

    const createdBaseline = ensureCreatedDiff({
      documentId: document.id,
      snapshot: document.content,
    });

    expect(createdBaseline?.source).toBe("created");
    expect(listDiffsByDocument(document.id).map((diff) => diff.source)).toEqual(
      expect.arrayContaining(["manual", "created"]),
    );
  });

  it("rejects invalid document ids for diff creation and idle saves", () => {
    const invalidCreate = createDiff({
      documentId: "   ",
      userId: "reviewer@example.com",
      snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
      source: "manual",
    });
    expect(invalidCreate).toBeNull();

    const saveResult = triggerIdleSave({
      documentId: "doc-\ninvalid",
      snapshot: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    });
    expect(saveResult).toEqual({
      skipped: true,
      reason: "invalid_document_id",
    });

    expect(listDiffsByDocument("doc-\ninvalid")).toEqual([]);
  });

  it("rejects malformed non-object createDiff payloads", () => {
    const diff = createDiff(123 as unknown as never);

    expect(diff).toBeNull();
  });

  it("handles createDiff payload getter traps safely", () => {
    const payloadWithThrowingRequiredField = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(payloadWithThrowingRequiredField, "documentId", {
      get() {
        throw new Error("documentId getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "snapshotAfter", {
      value: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    });
    Object.defineProperty(payloadWithThrowingRequiredField, "source", {
      value: "manual",
    });

    expect(
      createDiff(
        payloadWithThrowingRequiredField as unknown as Parameters<typeof createDiff>[0],
      ),
    ).toBeNull();

    const document = createDocument("Getter-safe diff payload");
    const payloadWithThrowingOptionalFields = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(payloadWithThrowingOptionalFields, "documentId", {
      value: document.id,
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "snapshotAfter", {
      value: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "source", {
      value: "manual",
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "userId", {
      get() {
        throw new Error("userId getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "aiPrompt", {
      get() {
        throw new Error("aiPrompt getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "aiModel", {
      get() {
        throw new Error("aiModel getter failed");
      },
    });
    Object.defineProperty(payloadWithThrowingOptionalFields, "previousSnapshot", {
      get() {
        throw new Error("previousSnapshot getter failed");
      },
    });

    const diff = createDiff(
      payloadWithThrowingOptionalFields as unknown as Parameters<typeof createDiff>[0],
    );
    expect(diff).not.toBeNull();
    expect(diff?.userId).toBe(DEFAULT_LOCAL_USER_ID);
    expect(diff?.aiPrompt).toBeUndefined();
    expect(diff?.aiModel).toBeUndefined();
  });

  it("rejects invalid snapshots for create/save/restore flows", () => {
    const document = createDocument("Invalid snapshot doc");

    const invalidCreate = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: "not-json",
      source: "manual",
    });
    expect(invalidCreate).toBeNull();

    const saveResult = triggerIdleSave({
      documentId: document.id,
      snapshot: "not-json",
    });
    expect(saveResult).toEqual({
      skipped: true,
      reason: "invalid_snapshot",
    });

    const restoreResult = restoreVersion({
      documentId: document.id,
      snapshot: "not-json",
    });
    expect(restoreResult).toEqual({
      restored: false,
      reason: "invalid_snapshot",
    });
  });

  it("rejects invalid diff source and metadata inputs", () => {
    const document = createDocument("Invalid metadata doc");
    const snapshot = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

    const invalidSource = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "automerge" as never,
    });
    const oversizedPrompt = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiPrompt: "a".repeat(4_001),
    });
    const multilinePrompt = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiPrompt: "Line one\nLine two",
    });
    const unknownModel = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiModel: "unknown-model",
    });
    const controlCharModel = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiModel: "gpt-\nmodel",
    });

    expect(invalidSource).toBeNull();
    expect(oversizedPrompt).toBeNull();
    expect(multilinePrompt).not.toBeNull();
    expect(multilinePrompt?.aiPrompt).toBe("Line one\nLine two");
    expect(unknownModel?.aiModel).toBe("gpt-4o");
    expect(controlCharModel).toBeNull();
  });

  it("drops ai model metadata when model config lookup throws", () => {
    const document = createDocument("Model lookup throw doc");
    const snapshot = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    vi.spyOn(aiModels, "getModelConfig").mockImplementation(() => {
      throw new Error("model lookup failed");
    });

    const diff = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiModel: "gpt-4o",
    });

    expect(diff).not.toBeNull();
    expect(diff?.aiModel).toBeUndefined();
  });

  it("falls back to local user id for invalid diff user ids", () => {
    const document = createDocument("User fallback doc");
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });

    const controlCharDiff = createDiff({
      documentId: document.id,
      userId: "bad\nuser",
      snapshotAfter: content,
      source: "manual",
    });
    const longUserDiff = createDiff({
      documentId: document.id,
      userId: "u".repeat(257),
      snapshotAfter: content,
      source: "manual",
    });

    expect(controlCharDiff?.userId).toBe(DEFAULT_LOCAL_USER_ID);
    expect(longUserDiff?.userId).toBe(DEFAULT_LOCAL_USER_ID);
  });

  it("filters malformed persisted diffs and normalizes legacy entries", () => {
    window.localStorage.setItem(
      "plan00.diffs.v1",
      JSON.stringify({
        diffs: [
          {
            id: "  valid-diff  ",
            documentId: "  doc-legacy  ",
            userId: "bad\nuser",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            aiPrompt: "   ",
            aiModel: " gpt-test ",
            createdAt: 2,
          },
          {
            id: "",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 3,
          },
          {
            id: 123,
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 3,
          },
          {
            id: "bad-source",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "automerge",
            createdAt: 4,
          },
          {
            id: "bad\nid",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 4,
          },
          {
            id: "d".repeat(257),
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 4,
          },
          {
            id: "bad-snapshot",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: "not-json",
            source: "manual",
            createdAt: 4,
          },
          {
            id: "bad-time",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: -1,
          },
          {
            id: "bad-metadata",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            aiPrompt: `bad${"\u0000"}prompt`,
            createdAt: 4,
          },
          {
            id: "valid-diff",
            documentId: "doc-legacy",
            userId: "u-2",
            patch: "@@ -0,0 +1 @@\n+latest",
            snapshotAfter: JSON.stringify({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "latest" }],
                },
              ],
            }),
            source: "manual",
            createdAt: 5,
          },
          {
            id: "valid-diff",
            documentId: "doc-legacy",
            userId: "u-3",
            patch: "@@ -0,0 +1 @@\n+stale",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 1,
          },
          null,
        ],
      }),
    );

    const diffs = listDiffsByDocument("doc-legacy");
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toEqual(
      expect.objectContaining({
        id: "valid-diff",
        documentId: "doc-legacy",
        userId: "u-2",
        source: "manual",
        aiPrompt: undefined,
        aiModel: undefined,
      }),
    );
  });

  it("skips persisted diffs when field getters throw during load", () => {
    const diffWithThrowingGetters = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(diffWithThrowingGetters, "id", {
      get() {
        throw new Error("id getter failed");
      },
    });
    Object.defineProperty(diffWithThrowingGetters, "documentId", {
      get() {
        throw new Error("documentId getter failed");
      },
    });
    Object.defineProperty(diffWithThrowingGetters, "source", {
      get() {
        throw new Error("source getter failed");
      },
    });
    Object.defineProperty(diffWithThrowingGetters, "snapshotAfter", {
      get() {
        throw new Error("snapshotAfter getter failed");
      },
    });
    Object.defineProperty(diffWithThrowingGetters, "createdAt", {
      get() {
        throw new Error("createdAt getter failed");
      },
    });

    window.localStorage.setItem("plan00.diffs.v1", "{}");
    vi.spyOn(JSON, "parse").mockReturnValue({
      diffs: [diffWithThrowingGetters],
    });

    expect(listDiffsByDocument("doc-legacy")).toEqual([]);
  });

  it("returns empty when persisted diffs container is non-array", () => {
    window.localStorage.setItem(
      "plan00.diffs.v1",
      JSON.stringify({ diffs: { id: "not-array" } }),
    );

    expect(listDiffsByDocument("doc-legacy")).toEqual([]);
  });

  it("returns empty for malformed non-string listDiffsByDocument inputs", () => {
    expect(listDiffsByDocument(123 as unknown as string)).toEqual([]);
  });

  it("uses deterministic id tie-breaker for same-timestamp diffs", () => {
    window.localStorage.setItem(
      "plan00.diffs.v1",
      JSON.stringify({
        diffs: [
          {
            id: "diff-b",
            documentId: "doc-order",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 10,
          },
          {
            id: "diff-a",
            documentId: "doc-order",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            createdAt: 10,
          },
        ],
      }),
    );

    expect(listDiffsByDocument("doc-order").map((diff) => diff.id)).toEqual([
      "diff-a",
      "diff-b",
    ]);
  });

  it("falls back to in-memory diffs when localStorage getter throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage getter failed");
      },
    });
    const document = createDocument("Memory diff doc");
    const snapshot = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "memory change" }] }],
    });

    const diff = createDiff({
      documentId: document.id,
      userId: "u-1",
      snapshotAfter: snapshot,
      source: "manual",
    });

    expect(diff).not.toBeNull();
    expect(listDiffsByDocument(document.id)).toEqual([
      expect.objectContaining({
        id: diff?.id,
      }),
    ]);
  });

  it("returns empty list when localStorage getItem throws", () => {
    const document = createDocument("GetItem diff doc");
    createDiff({
      documentId: document.id,
      userId: "u-1",
      snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
      source: "manual",
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("getItem failed");
    });

    expect(listDiffsByDocument(document.id)).toEqual([]);
  });

  it("returns normalized diff writes when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("setItem failed");
    });
    const document = createDocument("SetItem diff doc");
    const snapshot = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

    const diff = createDiff({
      documentId: `  ${document.id}  `,
      userId: "bad\nuser",
      snapshotAfter: snapshot,
      source: "manual",
    });

    expect(diff).toEqual(
      expect.objectContaining({
        documentId: document.id,
        userId: DEFAULT_LOCAL_USER_ID,
        source: "manual",
      }),
    );
  });
});
