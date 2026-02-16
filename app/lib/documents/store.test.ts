import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  resetDocumentsForTests,
  setDocumentLastDiffAt,
  setDocumentChatClearedAt,
  updateDocumentContent,
  updateDocumentTitle,
} from "@/lib/documents/store";
import { DEFAULT_LOCAL_USER_EMAIL } from "@/lib/user/defaults";
import { vi } from "vitest";

describe("document store", () => {
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
    window.localStorage.clear();
  });

  it("creates documents with normalized titles", () => {
    const document = createDocument("  Product spec  ");

    expect(document.title).toBe("Product spec");
    expect(document.content).toContain('"type":"doc"');
    expect(document.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
    expect(document.id).toBeTruthy();

    const controlCharTitle = createDocument("Bad\ntitle");
    expect(controlCharTitle.title).toBe("Untitled");
  });

  it("floors created timestamps at zero when system clock is negative", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);
    const document = createDocument("Clock floor");

    expect(document.createdAt).toBe(0);
    expect(document.updatedAt).toBe(0);
    nowSpy.mockRestore();
  });

  it("falls back to default owner email for invalid owner input", () => {
    const blankOwner = createDocument("Blank owner", "   ");
    expect(blankOwner.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);

    const controlCharOwner = createDocument("Bad owner", "owner\nname@example.com");
    expect(controlCharOwner.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);

    const malformedOwner = createDocument("Malformed owner", "not-an-email");
    expect(malformedOwner.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });

  it("lists documents sorted by updatedAt desc and searchable", async () => {
    const first = createDocument("First");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = createDocument("Second Plan");

    const all = listDocuments();
    expect(all.map((doc) => doc.id)).toEqual([second.id, first.id]);

    const filtered = listDocuments("plan");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(second.id);

    const fromNonStringQuery = listDocuments(123 as unknown as string);
    expect(fromNonStringQuery).toHaveLength(2);
  });

  it("uses deterministic id tie-breaker for equal updatedAt timestamps", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "doc-b",
            title: "Doc B",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 10,
          },
          {
            id: "doc-a",
            title: "Doc A",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 10,
          },
        ],
      }),
    );

    expect(listDocuments().map((document) => document.id)).toEqual(["doc-a", "doc-b"]);
  });

  it("prefers newer createdAt when duplicate records share equal updatedAt", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "doc-same-updated",
            title: "Older createdAt",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "older@example.com",
            createdAt: 1,
            updatedAt: 10,
          },
          {
            id: "doc-same-updated",
            title: "Newer createdAt",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "newer@example.com",
            createdAt: 5,
            updatedAt: 10,
          },
        ],
      }),
    );

    expect(listDocuments()).toEqual([
      expect.objectContaining({
        id: "doc-same-updated",
        title: "Newer createdAt",
        ownerEmail: "newer@example.com",
        createdAt: 5,
        updatedAt: 10,
      }),
    ]);
  });

  it("normalizes legacy stored owner emails when loading from storage", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "legacy-doc",
            title: "Legacy",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "   ",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    const documents = listDocuments();
    expect(documents[0]?.ownerEmail).toBe(DEFAULT_LOCAL_USER_EMAIL);
  });

  it("falls back to Untitled for malformed persisted document titles", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "legacy-title",
            title: "bad\ntitle",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    );

    expect(listDocuments()[0]?.title).toBe("Untitled");
  });

  it("uses one shared fallback timestamp when normalizing malformed persisted docs", () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockImplementationOnce(() => 100)
      .mockImplementation(() => 999);

    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "legacy-a",
            title: "A",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: "bad",
            updatedAt: "bad",
          },
          {
            id: "legacy-b",
            title: "B",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: "bad",
            updatedAt: "bad",
          },
        ],
      }),
    );

    const documents = listDocuments();
    expect(documents.map((document) => document.createdAt)).toEqual([100, 100]);
    expect(documents.map((document) => document.updatedAt)).toEqual([100, 100]);
    nowSpy.mockRestore();
  });

  it("filters malformed persisted documents and normalizes legacy fields", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "  doc-legacy  ",
            title: "   ",
            content: "not-json",
            ownerEmail: " USER@EXAMPLE.COM ",
            createdAt: "1",
            updatedAt: 2,
            lastDiffAt: -5,
            chatClearedAt: -10,
          },
          {
            id: "doc-\ninvalid",
            title: "Bad id",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "user@example.com",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 123,
            title: "Numeric id",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "user@example.com",
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "doc-legacy",
            title: "Latest title",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "latest@example.com",
            createdAt: 20,
            updatedAt: 30,
          },
          {
            id: "doc-legacy",
            title: "Stale but later in array",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "stale@example.com",
            createdAt: 1,
            updatedAt: 1,
          },
          null,
        ],
      }),
    );

    const documents = listDocuments();
    expect(documents).toHaveLength(1);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        id: "doc-legacy",
        title: "Latest title",
        ownerEmail: "latest@example.com",
        content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        lastDiffAt: undefined,
        chatClearedAt: undefined,
      }),
    );
    expect(documents[0].createdAt).toBe(20);
    expect(documents[0].updatedAt).toBeGreaterThanOrEqual(documents[0].createdAt);
  });

  it("returns empty when persisted documents container is non-array", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({ documents: { id: "not-array" } }),
    );

    expect(listDocuments()).toEqual([]);
  });

  it("normalizes malformed persisted ai lock metadata", () => {
    window.localStorage.setItem(
      "plan00.documents.v1",
      JSON.stringify({
        documents: [
          {
            id: "doc-lock-invalid",
            title: "Invalid lock",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 1,
            updatedAt: 1,
            aiLockedBy: "bad\nuser",
            aiLockedAt: -10,
          },
          {
            id: "doc-lock-valid",
            title: "Valid lock",
            content: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
            ownerEmail: "owner@example.com",
            createdAt: 2,
            updatedAt: 2,
            aiLockedBy: "  owner@example.com  ",
            aiLockedAt: 10,
          },
        ],
      }),
    );

    const invalid = getDocumentById("doc-lock-invalid");
    const valid = getDocumentById("doc-lock-valid");

    expect(invalid).toEqual(
      expect.objectContaining({
        aiLockedBy: undefined,
        aiLockedAt: undefined,
      }),
    );
    expect(valid).toEqual(
      expect.objectContaining({
        aiLockedBy: "owner@example.com",
        aiLockedAt: 10,
      }),
    );
  });

  it("gets a document by id", () => {
    const created = createDocument("Roadmap");

    const fetched = getDocumentById(created.id);
    expect(fetched?.title).toBe("Roadmap");

    const padded = getDocumentById(`  ${created.id}  `);
    expect(padded?.id).toBe(created.id);
  });

  it("updates document chatClearedAt timestamp", () => {
    const created = createDocument("Chat doc");
    const updated = setDocumentChatClearedAt(created.id, 1234);

    expect(updated?.chatClearedAt).toBe(1234);
    expect(getDocumentById(created.id)?.chatClearedAt).toBe(1234);
  });

  it("updates document content only for valid prosemirror doc json", () => {
    const created = createDocument("Content doc");
    const validContent = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
    });

    const updated = updateDocumentContent(created.id, validContent);
    expect(updated?.content).toBe(validContent);

    const invalid = updateDocumentContent(created.id, "not-json");
    expect(invalid).toBeUndefined();
    expect(getDocumentById(created.id)?.content).toBe(validContent);
  });

  it("treats unchanged document updates as no-ops", () => {
    const created = createDocument("No-op doc");

    expect(updateDocumentTitle(created.id, "No-op doc")).toBeUndefined();
    expect(updateDocumentContent(created.id, created.content)).toBeUndefined();

    const firstDiffAt = setDocumentLastDiffAt(created.id, 1234);
    expect(firstDiffAt?.lastDiffAt).toBe(1234);
    expect(setDocumentLastDiffAt(created.id, 1234)).toBeUndefined();
    expect(setDocumentLastDiffAt(created.id, 1233)).toBeUndefined();

    const firstClearedAt = setDocumentChatClearedAt(created.id, 5678);
    expect(firstClearedAt?.chatClearedAt).toBe(5678);
    expect(setDocumentChatClearedAt(created.id, 5678)).toBeUndefined();
    expect(setDocumentChatClearedAt(created.id, 5677)).toBeUndefined();
  });

  it("keeps updatedAt monotonic when content/title updates occur with skewed clocks", () => {
    const created = createDocument("Monotonic");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(created.updatedAt - 5_000);

    const updatedTitle = updateDocumentTitle(created.id, "Monotonic updated");
    expect(updatedTitle?.updatedAt).toBe(created.updatedAt);

    const updatedContent = updateDocumentContent(
      created.id,
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
      }),
    );
    expect(updatedContent?.updatedAt).toBe(created.updatedAt);
    nowSpy.mockRestore();
  });

  it("keeps updatedAt non-negative when update clock is negative", () => {
    const created = createDocument("Negative clock updates");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-42);

    const updatedTitle = updateDocumentTitle(created.id, "Still valid");
    expect(updatedTitle?.updatedAt).toBe(created.updatedAt);
    expect(updatedTitle?.updatedAt).toBeGreaterThanOrEqual(0);

    const updatedContent = updateDocumentContent(
      created.id,
      JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
      }),
    );
    expect(updatedContent?.updatedAt).toBe(created.updatedAt);
    expect(updatedContent?.updatedAt).toBeGreaterThanOrEqual(0);

    nowSpy.mockRestore();
  });

  it("deletes document by id", () => {
    const created = createDocument("Delete me");
    const removed = deleteDocument(created.id);
    expect(removed).toBe(true);
    expect(getDocumentById(created.id)).toBeUndefined();
  });

  it("does not persist delete operations when target is missing", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    expect(deleteDocument("missing-doc")).toBe(false);
    expect(deleteDocument("   ")).toBe(false);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid document ids for document operations", () => {
    expect(getDocumentById("   ")).toBeUndefined();
    expect(updateDocumentTitle("   ", "Ignored")).toBeUndefined();
    expect(setDocumentLastDiffAt("doc-valid", Number.NaN)).toBeUndefined();
    expect(setDocumentLastDiffAt("doc-valid", -1)).toBeUndefined();
    expect(setDocumentChatClearedAt("doc-\ninvalid", 123)).toBeUndefined();
    expect(setDocumentChatClearedAt("doc-valid", Number.NaN)).toBeUndefined();
    expect(setDocumentChatClearedAt("doc-valid", -1)).toBeUndefined();
    expect(deleteDocument("doc-\ninvalid")).toBe(false);
  });

  it("handles malformed non-string runtime inputs safely", () => {
    expect(getDocumentById(123 as unknown as string)).toBeUndefined();
    expect(updateDocumentTitle(123 as unknown as string, "Ignored")).toBeUndefined();
    expect(updateDocumentContent("doc-valid", 123 as unknown as string)).toBeUndefined();
    expect(setDocumentLastDiffAt("doc-valid", "123" as unknown as number)).toBeUndefined();
    expect(
      setDocumentChatClearedAt("doc-valid", "123" as unknown as number),
    ).toBeUndefined();
    expect(deleteDocument(123 as unknown as string)).toBe(false);
  });

  it("falls back to in-memory state when localStorage getter throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage getter failed");
      },
    });

    const created = createDocument("Memory only");
    expect(created.title).toBe("Memory only");
    expect(listDocuments().map((document) => document.id)).toContain(created.id);
  });

  it("returns empty list when localStorage getItem throws", () => {
    createDocument("Persisted");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("getItem failed");
    });

    expect(listDocuments()).toEqual([]);
  });

  it("returns normalized writes even when localStorage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("setItem failed");
    });

    const created = createDocument("SetItem fails");
    expect(created.title).toBe("SetItem fails");
    expect(created.content).toContain('"type":"doc"');
  });

  it("updates document title and normalizes empty title", () => {
    const created = createDocument("Old title");
    const renamed = updateDocumentTitle(created.id, "  New title  ");
    expect(renamed?.title).toBe("New title");

    const untitled = updateDocumentTitle(created.id, "   ");
    expect(untitled?.title).toBe("Untitled");

    const controlCharDoc = createDocument("Control");
    const controlCharTitle = updateDocumentTitle(controlCharDoc.id, "bad\ntitle");
    expect(controlCharTitle?.title).toBe("Untitled");
  });
});
