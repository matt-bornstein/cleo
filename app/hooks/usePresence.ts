"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isValidDocumentId, normalizeDocumentId } from "@/lib/ai/documentId";
import {
  listPresence,
  removePresence,
  updatePresence,
} from "@/lib/presence/store";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";
import { generateLocalId } from "@/lib/utils/id";

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
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.updatedAt !== "number" ||
        !Number.isFinite(entry.updatedAt)
      ) {
        return false;
      }
      const ageMs = safeNow - entry.updatedAt;
      return (
        entry.updatedAt >= 0 &&
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
  const [currentTime, setCurrentTime] = useState(() => Math.max(0, Date.now()));

  const refresh = useCallback(() => {
    setVersion((value) => value + 1);
    setCurrentTime(Math.max(0, Date.now()));
  }, []);

  useEffect(() => {
    if (!hasValidDocumentId) {
      removePresence(visitorId);
      return;
    }

    const heartbeatInterval = setInterval(() => {
      updatePresence({
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
      clearInterval(heartbeatInterval);
      removePresence(visitorId);
      refresh();
    };
  }, [hasValidDocumentId, normalizedDocumentId, refresh, visitorId]);

  const allPresence = useMemo(() => {
    void version;
    if (!hasValidDocumentId) return [];
    return filterStalePresence(listPresence(normalizedDocumentId), currentTime);
  }, [currentTime, hasValidDocumentId, normalizedDocumentId, version]);

  const me = allPresence.find((entry) => entry.visitorId === visitorId);
  const others = allPresence.filter((entry) => entry.visitorId !== visitorId);

  const updateMyPresence = useCallback(
    (data: unknown) => {
      if (!hasValidDocumentId) return;
      const normalizedData = normalizePresenceData(data);
      updatePresence({
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
