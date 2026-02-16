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
        const rawName = readPresenceDataField(data, "name");
        const normalizedName =
          typeof rawName === "string" &&
          rawName.trim().length > 0 &&
          !hasControlChars(rawName.trim())
            ? rawName.trim()
            : "Collaborator";
        const rawColor = readPresenceDataField(data, "color");
        const normalizedColor =
          typeof rawColor === "string" && rawColor.trim().length > 0
            ? rawColor.trim()
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

  const id = readPresenceField(presence, "id");
  const data = readPresenceField(presence, "data");
  return {
    id: typeof id === "string" && id.trim().length > 0
      ? id.trim()
      : undefined,
    data:
      data && typeof data === "object"
        ? (data as { name?: unknown; color?: unknown })
        : undefined,
  };
}

function readPresenceDataField(
  data: { name?: unknown; color?: unknown } | undefined,
  key: "name" | "color",
) {
  if (!data) {
    return undefined;
  }

  try {
    return data[key];
  } catch {
    return undefined;
  }
}

function readPresenceField(presence: unknown, key: "id" | "data") {
  if (!presence || typeof presence !== "object") {
    return undefined;
  }

  try {
    return (presence as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}
