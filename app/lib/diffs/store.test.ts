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
});
