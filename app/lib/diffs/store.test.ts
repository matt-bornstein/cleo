import { createDocument, getDocumentById, resetDocumentsForTests } from "@/lib/documents/store";
import {
  createDiff,
  ensureCreatedDiff,
  listDiffsByDocument,
  resetDiffsForTests,
  restoreVersion,
  triggerIdleSave,
} from "@/lib/diffs/store";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";

describe("diff store triggerIdleSave", () => {
  beforeEach(() => {
    resetDocumentsForTests();
    resetDiffsForTests();
    window.localStorage.clear();
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
    const controlCharModel = createDiff({
      documentId: document.id,
      userId: "reviewer@example.com",
      snapshotAfter: snapshot,
      source: "manual",
      aiModel: "gpt-\nmodel",
    });

    expect(invalidSource).toBeNull();
    expect(oversizedPrompt).toBeNull();
    expect(controlCharModel).toBeNull();
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
            id: "bad-source",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "automerge",
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
            id: "bad-metadata",
            documentId: "doc-legacy",
            userId: "u-1",
            patch: "@@ -0,0 +1 @@\n+text",
            snapshotAfter: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            source: "manual",
            aiPrompt: "bad\nprompt",
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
});
