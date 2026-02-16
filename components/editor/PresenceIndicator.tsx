"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresenceIndicatorProps {
  documentId: Id<"documents">;
}

export function PresenceIndicator({ documentId }: PresenceIndicatorProps) {
  const presenceList = useQuery(api.presence.list, { documentId });

  if (!presenceList || presenceList.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {presenceList.slice(0, 5).map((p) => (
        <Tooltip key={p._id}>
          <TooltipTrigger asChild>
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
              style={{
                backgroundColor: (p.data as { color?: string })?.color || "#888",
              }}
            >
              {(p.userName || "?")[0].toUpperCase()}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{p.userName}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      {presenceList.length > 5 && (
        <span className="text-xs text-muted-foreground">
          +{presenceList.length - 5}
        </span>
      )}
    </div>
  );
}
