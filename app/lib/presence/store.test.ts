import {
  listPresence,
  removePresence,
  resetPresenceForTests,
  updatePresence,
} from "@/lib/presence/store";
import { vi } from "vitest";

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

  it("floors updated timestamps at zero for negative clocks", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(-1000);
    const updated = updatePresence({
      documentId: "doc-presence-floor",
      visitorId: "visitor-floor",
      userId: "user-1",
      data: {},
    });

    expect(updated).not.toBeNull();
    expect(updated?.updatedAt).toBe(0);
    nowSpy.mockRestore();
  });

  it("keeps updatedAt monotonic when clocks move backwards", () => {
    const first = updatePresence({
      documentId: "doc-clock",
      visitorId: "visitor-1",
      userId: "user-1",
      data: { state: "first" },
    });
    expect(first).not.toBeNull();

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue((first?.updatedAt ?? 0) - 5000);
    const second = updatePresence({
      documentId: "doc-clock",
      visitorId: "visitor-1",
      userId: "user-1",
      data: { state: "second" },
    });

    expect(second).not.toBeNull();
    expect(second?.updatedAt).toBe(first?.updatedAt);
    nowSpy.mockRestore();
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

  it("does not persist remove operations when visitor is absent", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    removePresence("missing-visitor");
    removePresence("bad\nvisitor");
    expect(setItemSpy).not.toHaveBeenCalled();
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
            id: 123,
            documentId: "doc-valid",
            visitorId: "visitor-2",
            userId: "user-2",
            data: {},
            updatedAt: 2,
          },
          {
            id: "bad\nid",
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
          {
            id: "bad-time",
            documentId: "doc-valid",
            visitorId: "visitor-4",
            userId: "user-3",
            data: {},
            updatedAt: -1,
          },
          {
            id: "duplicate-visitor",
            documentId: "doc-valid",
            visitorId: "visitor-1",
            userId: "user-2",
            data: { name: "Latest" },
            updatedAt: 4,
          },
          {
            id: "stale-late-entry",
            documentId: "doc-valid",
            visitorId: "visitor-1",
            userId: "user-3",
            data: { name: "Stale but later in array" },
            updatedAt: 1,
          },
        ],
      }),
    );

    const entries = listPresence("doc-valid");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: "duplicate-visitor",
        documentId: "doc-valid",
        visitorId: "visitor-1",
        userId: "user-2",
      }),
    );
  });

  it("returns document presence ordered by latest update timestamp", () => {
    window.localStorage.setItem(
      "plan00.presence.v1",
      JSON.stringify({
        presence: [
          {
            id: "first",
            documentId: "doc-order",
            visitorId: "visitor-1",
            userId: "user-1",
            data: {},
            updatedAt: 1,
          },
          {
            id: "second",
            documentId: "doc-order",
            visitorId: "visitor-2",
            userId: "user-2",
            data: {},
            updatedAt: 2,
          },
        ],
      }),
    );

    expect(listPresence("doc-order").map((entry) => entry.id)).toEqual([
      "second",
      "first",
    ]);
  });

  it("dedupes same visitor by newest timestamp then stable id tie-breaker", () => {
    window.localStorage.setItem(
      "plan00.presence.v1",
      JSON.stringify({
        presence: [
          {
            id: "visitor-record-b",
            documentId: "doc-dedupe",
            visitorId: "visitor-1",
            userId: "user-1",
            data: {},
            updatedAt: 5,
          },
          {
            id: "visitor-record-a",
            documentId: "doc-dedupe",
            visitorId: "visitor-1",
            userId: "user-2",
            data: {},
            updatedAt: 5,
          },
        ],
      }),
    );

    expect(listPresence("doc-dedupe")).toEqual([
      expect.objectContaining({
        id: "visitor-record-a",
        visitorId: "visitor-1",
        userId: "user-2",
      }),
    ]);
  });

  it("uses visitor id tie-breaker for equal update timestamps", () => {
    window.localStorage.setItem(
      "plan00.presence.v1",
      JSON.stringify({
        presence: [
          {
            id: "presence-b",
            documentId: "doc-order-tie",
            visitorId: "visitor-b",
            userId: "user-1",
            data: {},
            updatedAt: 1,
          },
          {
            id: "presence-a",
            documentId: "doc-order-tie",
            visitorId: "visitor-a",
            userId: "user-1",
            data: {},
            updatedAt: 1,
          },
        ],
      }),
    );

    expect(listPresence("doc-order-tie").map((entry) => entry.id)).toEqual([
      "presence-a",
      "presence-b",
    ]);
  });

  it("normalizes non-serializable presence payload data", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const updated = updatePresence({
      documentId: "doc-serializable",
      visitorId: "visitor-circular",
      userId: "user-1",
      data: circular,
    });

    expect(updated).not.toBeNull();
    expect(updated?.data).toBeNull();
    expect(listPresence("doc-serializable")[0]?.data).toBeNull();
  });
});
