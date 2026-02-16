"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listPresence,
  removePresence,
  updatePresence,
} from "@/lib/presence/store";
import { DEFAULT_LOCAL_USER_ID } from "@/lib/user/defaults";

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

function createVisitorId() {
  return `visitor-${crypto.randomUUID()}`;
}

export function filterStalePresence<
  T extends {
    updatedAt: number;
  },
>(entries: T[], now: number, maxAgeMs = 10_000) {
  return entries.filter((entry) => now - entry.updatedAt < maxAgeMs);
}

export function usePresence(documentId: string) {
  const normalizedDocumentId = documentId.trim();
  const [visitorId] = useState(createVisitorId);
  const [version, setVersion] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setVersion((value) => value + 1);
    setCurrentTime(Date.now());
  }, []);

  useEffect(() => {
    if (!normalizedDocumentId) {
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
  }, [normalizedDocumentId, refresh, visitorId]);

  const allPresence = useMemo(() => {
    void version;
    if (!normalizedDocumentId) return [];
    return filterStalePresence(listPresence(normalizedDocumentId), currentTime);
  }, [currentTime, normalizedDocumentId, version]);

  const me = allPresence.find((entry) => entry.visitorId === visitorId);
  const others = allPresence.filter((entry) => entry.visitorId !== visitorId);

  const updateMyPresence = useCallback(
    (data: PresenceData) => {
      updatePresence({
        documentId: normalizedDocumentId,
        visitorId,
        userId: CURRENT_USER.id,
        data,
      });
      refresh();
    },
    [normalizedDocumentId, refresh, visitorId],
  );

  return {
    me,
    others,
    updateMyPresence,
  };
}
