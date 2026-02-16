import { createDocument, getDocumentById, resetDocumentsForTests } from "@/lib/documents/store";
import {
  listDiffsByDocument,
  resetDiffsForTests,
  triggerIdleSave,
} from "@/lib/diffs/store";

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
});
