"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import {
  listPresence,
  removePresence,
  updatePresence,
} from "@/lib/presence/store";
import type { PresenceRecord } from "@/lib/types";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { generateLocalId } from "@/lib/utils/id";
import { hasControlChars } from "@/lib/validators/controlChars";

type PresenceData = {
  name: string;
  color: string;
  cursor?: number;
  selection?: { from: number; to: number };
};

const CURRENT_USER = {
  id: DEFAULT_LOCAL_USER_ID,
  name: "You",
  color: "#3b82f6",
};

function normalizePresenceData(data: unknown): PresenceData {
  if (data && typeof data === "object") {
    return data as PresenceData;
  }

  return {
    name: CURRENT_USER.name,
    color: CURRENT_USER.color,
  };
}

function createVisitorId() {
  return generateLocalId("visitor");
}

export function filterStalePresence<
  T extends {
    updatedAt: number;
  },
>(entries: T[], now: number, maxAgeMs = 10_000) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const safeNow = Number.isFinite(now) ? Math.max(0, now) : 0;
  const safeMaxAge =
    Number.isFinite(maxAgeMs) && maxAgeMs >= 0 ? maxAgeMs : 10_000;
  return entries.filter(
    (entry) => {
      const updatedAt = readEntryUpdatedAt(entry);
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof updatedAt !== "number" ||
        !Number.isFinite(updatedAt)
      ) {
        return false;
      }
      const ageMs = safeNow - updatedAt;
      return (
        updatedAt >= 0 &&
        ageMs < safeMaxAge &&
        ageMs >= -safeMaxAge
      );
    },
  );
}

export function usePresence(documentId: unknown) {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  const hasValidDocumentId = isValidDocumentId(normalizedDocumentId);
  const [visitorId] = useState(createVisitorId);
  const [version, setVersion] = useState(0);
  const [currentTime, setCurrentTime] = useState(safeNow);

  const refresh = useCallback(() => {
    setVersion((value) => value + 1);
    setCurrentTime(safeNow());
  }, []);

  useEffect(() => {
    if (!hasValidDocumentId) {
      safeRemovePresence(visitorId);
      return;
    }

    const heartbeatInterval = safeSetInterval(() => {
      safeUpdatePresence({
        documentId: normalizedDocumentId,
        visitorId,
        userId: CURRENT_USER.id,
        data: {
          name: CURRENT_USER.name,
          color: CURRENT_USER.color,
        } as PresenceData,
      });
      refresh();
    }, 5000);

    return () => {
      if (heartbeatInterval) {
        safeClearInterval(heartbeatInterval);
      }
      safeRemovePresence(visitorId);
      refresh();
    };
  }, [hasValidDocumentId, normalizedDocumentId, refresh, visitorId]);

  const allPresence = useMemo(() => {
    void version;
    if (!hasValidDocumentId) return [];
    return filterStalePresence(
      safeNormalizePresenceEntries(
        safeListPresence(normalizedDocumentId),
        normalizedDocumentId,
      ),
      currentTime,
    );
  }, [currentTime, hasValidDocumentId, normalizedDocumentId, version]);

  const me = allPresence.find((entry) => entry.visitorId === visitorId);
  const others = allPresence.filter((entry) => entry.visitorId !== visitorId);

  const updateMyPresence = useCallback(
    (data: unknown) => {
      if (!hasValidDocumentId) return;
      const normalizedData = normalizePresenceData(data);
      safeUpdatePresence({
        documentId: normalizedDocumentId,
        visitorId,
        userId: CURRENT_USER.id,
        data: normalizedData,
      });
      refresh();
    },
    [hasValidDocumentId, normalizedDocumentId, refresh, visitorId],
  );

  return {
    me,
    others,
    updateMyPresence,
  };
}

function safeNow() {
  try {
    return Math.max(0, Date.now());
  } catch {
    return 0;
  }
}

function safeSetInterval(callback: () => void, delayMs: number) {
  try {
    return setInterval(callback, delayMs);
  } catch {
    return null;
  }
}

function safeClearInterval(intervalId: ReturnType<typeof setInterval>) {
  try {
    clearInterval(intervalId);
  } catch {
    return;
  }
}

function safeListPresence(documentId: string) {
  try {
    return listPresence(documentId);
  } catch {
    return [];
  }
}

function safeUpdatePresence(payload: Parameters<typeof updatePresence>[0]) {
  try {
    updatePresence(payload);
  } catch {
    return;
  }
}

function safeRemovePresence(visitorId: string) {
  try {
    removePresence(visitorId);
  } catch {
    return;
  }
}

function readEntryUpdatedAt(entry: unknown) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  try {
    return (entry as { updatedAt?: unknown }).updatedAt;
  } catch {
    return undefined;
  }
}

function safeNormalizePresenceEntries(entries: unknown, fallbackDocumentId: string) {
  if (!Array.isArray(entries)) {
    return [] as PresenceRecord[];
  }

  return entries.flatMap((entry, index) => {
    const normalizedEntry = safeNormalizePresenceEntry(entry, fallbackDocumentId, index);
    return normalizedEntry ? [normalizedEntry] : [];
  });
}

function safeNormalizePresenceEntry(
  entry: unknown,
  fallbackDocumentId: string,
  fallbackIndex: number,
) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const visitorId = safeReadPresenceField(entry, "visitorId");
  const normalizedVisitorId =
    typeof visitorId === "string" &&
    visitorId.trim().length > 0 &&
    !hasControlChars(visitorId.trim())
      ? visitorId.trim()
      : undefined;
  if (!normalizedVisitorId) {
    return null;
  }
  const id = safeReadPresenceField(entry, "id");
  const documentId = safeReadPresenceField(entry, "documentId");
  const userId = safeReadPresenceField(entry, "userId");
  const data = safeReadPresenceField(entry, "data");
  const updatedAt = safeReadPresenceField(entry, "updatedAt");

  return {
    id:
      typeof id === "string" && id.trim().length > 0 && !hasControlChars(id.trim())
        ? id.trim()
        : `presence-${fallbackIndex}`,
    documentId:
      typeof documentId === "string" &&
      documentId.trim().length > 0 &&
      !hasControlChars(documentId.trim())
        ? documentId.trim()
        : fallbackDocumentId,
    visitorId: normalizedVisitorId,
    userId:
      typeof userId === "string" &&
      userId.trim().length > 0 &&
      !hasControlChars(userId.trim())
        ? userId.trim()
        : DEFAULT_LOCAL_USER_ID,
    data: normalizePresenceData(data),
    updatedAt:
      typeof updatedAt === "number" && Number.isFinite(updatedAt) && updatedAt >= 0
        ? updatedAt
        : 0,
  } satisfies PresenceRecord;
}

function safeReadPresenceField(
  entry: unknown,
  key: keyof PresenceRecord,
) {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  try {
    return (entry as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
