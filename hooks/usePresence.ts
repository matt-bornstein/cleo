"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
];

export interface PresenceData {
  cursor?: number;
  selection?: { from: number; to: number };
  color: string;
  name: string;
}

function generateVisitorId(): string {
  return `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getColor(index: number): string {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

export function usePresence(documentId: Id<"documents">, userName: string) {
  const [visitorId] = useState(() => generateVisitorId());
  const updatePresence = useMutation(api.presence.update);
  const heartbeat = useMutation(api.presence.heartbeat);
  const removePresence = useMutation(api.presence.remove);
  const others = useQuery(api.presence.list, { documentId });
  const colorIndexRef = useRef(Math.floor(Math.random() * CURSOR_COLORS.length));

  // Register presence immediately on mount
  useEffect(() => {
    updatePresence({
      documentId,
      visitorId,
      data: {
        color: getColor(colorIndexRef.current),
        name: userName,
      },
    }).catch(() => {});
  }, [documentId, visitorId, updatePresence, userName]);

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      heartbeat({ visitorId }).catch(() => {});
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [heartbeat, visitorId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removePresence({ visitorId }).catch(() => {});
    };
  }, [removePresence, visitorId]);

  const updateMyPresence = useCallback(
    (data: Partial<PresenceData>) => {
      updatePresence({
        documentId,
        visitorId,
        data: {
          ...data,
          color: getColor(colorIndexRef.current),
          name: userName,
        },
      }).catch(() => {});
    },
    [documentId, visitorId, updatePresence, userName]
  );

  // Other users' presence (excludes self)
  const othersPresence = (others ?? []).filter(
    (p) => p.visitorId !== visitorId
  );

  // All presence including self
  const allPresence = others ?? [];

  return {
    visitorId,
    othersPresence,
    allPresence,
    updateMyPresence,
  };
}
