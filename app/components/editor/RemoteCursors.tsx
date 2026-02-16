import { hasControlChars } from "@/lib/validators/controlChars";

type RemoteCursorsProps = {
  others: unknown;
};

export function RemoteCursors({ others }: RemoteCursorsProps) {
  const normalizedOthers = Array.isArray(others)
    ? others.flatMap((presence) => {
        const normalizedPresence = normalizePresenceEntry(presence);
        if (!normalizedPresence) {
          return [];
        }
        const normalizedId = normalizedPresence.id;
        if (!normalizedId || hasControlChars(normalizedId)) {
          return [];
        }
        const data = normalizedPresence.data;
        const normalizedName =
          typeof data?.name === "string" &&
          data.name.trim().length > 0 &&
          !hasControlChars(data.name.trim())
            ? data.name.trim()
            : "Collaborator";
        const normalizedColor =
          typeof data?.color === "string" && data.color.trim().length > 0
            ? data.color.trim()
            : "#64748b";

        return [
          {
            id: normalizedId,
            name: normalizedName,
            color: normalizedColor,
          },
        ];
      })
    : [];

  if (normalizedOthers.length === 0) {
    return (
      <div className="text-xs text-slate-500">No other collaborators online.</div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {normalizedOthers.map((presence) => {
        return (
          <span
            key={presence.id}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: presence.color }}
            />
            {presence.name}
          </span>
        );
      })}
    </div>
  );
}

function normalizePresenceEntry(presence: unknown) {
  if (!presence || typeof presence !== "object") {
    return undefined;
  }

  try {
    const candidate = presence as {
      id?: unknown;
      data?: unknown;
    };
    return {
      id: typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : undefined,
      data:
        candidate.data && typeof candidate.data === "object"
          ? (candidate.data as { name?: unknown; color?: unknown })
          : undefined,
    };
  } catch {
    return undefined;
  }
}
