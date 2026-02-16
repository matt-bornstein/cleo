"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listPresence,
  removePresence,
  updatePresence,
} from "@/lib/presence/store";

type PresenceData = {
  name: string;
  color: string;
  cursor?: number;
  selection?: { from: number; to: number };
};

const CURRENT_USER = {
  id: "local-dev-user",
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
  const [visitorId] = useState(createVisitorId);
  const [version, setVersion] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setVersion((value) => value + 1);
    setCurrentTime(Date.now());
  }, []);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      updatePresence({
        documentId,
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
  }, [documentId, refresh, visitorId]);

  const allPresence = useMemo(() => {
    void version;
    return filterStalePresence(listPresence(documentId), currentTime);
  }, [currentTime, documentId, version]);

  const me = allPresence.find((entry) => entry.visitorId === visitorId);
  const others = allPresence.filter((entry) => entry.visitorId !== visitorId);

  const updateMyPresence = useCallback(
    (data: PresenceData) => {
      updatePresence({
        documentId,
        visitorId,
        userId: CURRENT_USER.id,
        data,
      });
      refresh();
    },
    [documentId, refresh, visitorId],
  );

  return {
    me,
    others,
    updateMyPresence,
  };
}
