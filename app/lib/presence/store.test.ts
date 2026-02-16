import {
  listPresence,
  removePresence,
  resetPresenceForTests,
  updatePresence,
} from "@/lib/presence/store";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";

describe("presence store", () => {
  beforeEach(() => {
    resetPresenceForTests();
    window.localStorage.clear();
  });

  it("normalizes document and visitor ids while storing presence", () => {
    const updated = updatePresence({
      documentId: "  doc-presence  ",
      visitorId: "  visitor-1  ",
      userId: "  user-1  ",
      data: { name: "Me" },
    });

    expect(updated).not.toBeNull();
    expect(updated?.documentId).toBe("doc-presence");
    expect(updated?.visitorId).toBe("visitor-1");
    expect(updated?.userId).toBe("user-1");

    expect(listPresence("doc-presence")).toHaveLength(1);
    expect(listPresence("  doc-presence  ")).toHaveLength(1);
  });

  it("rejects invalid presence updates and visitor removals", () => {
    const invalidDocument = updatePresence({
      documentId: "doc-\ninvalid",
      visitorId: "visitor-1",
      userId: "user-1",
      data: {},
    });
    const invalidVisitor = updatePresence({
      documentId: "doc-valid",
      visitorId: "   ",
      userId: "user-1",
      data: {},
    });

    expect(invalidDocument).toBeNull();
    expect(invalidVisitor).toBeNull();
    expect(listPresence("doc-valid")).toEqual([]);

    removePresence("bad\nvisitor");
    expect(listPresence("doc-valid")).toEqual([]);
  });

  it("filters malformed persisted presence entries and normalizes user fallback", () => {
    window.localStorage.setItem(
      "plan00.presence.v1",
      JSON.stringify({
        presence: [
          {
            id: "  valid-presence  ",
            documentId: "  doc-valid  ",
            visitorId: "  visitor-1  ",
            userId: "bad\nuser",
            data: { name: "Legacy" },
            updatedAt: 1,
          },
          {
            id: "",
            documentId: "doc-valid",
            visitorId: "visitor-2",
            userId: "user-2",
            data: {},
            updatedAt: 2,
          },
          {
            id: "bad-doc",
            documentId: "doc-\ninvalid",
            visitorId: "visitor-3",
            userId: "user-3",
            data: {},
            updatedAt: 3,
          },
        ],
      }),
    );

    const entries = listPresence("doc-valid");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: "valid-presence",
        documentId: "doc-valid",
        visitorId: "visitor-1",
        userId: DEFAULT_LOCAL_USER_ID,
      }),
    );
  });
});
