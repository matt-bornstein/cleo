import type { PresenceRecord } from "@/lib/types";

type RemoteCursorsProps = {
  others: PresenceRecord[];
};

export function RemoteCursors({ others }: RemoteCursorsProps) {
  if (others.length === 0) {
    return (
      <div className="text-xs text-slate-500">No other collaborators online.</div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {others.map((presence) => {
        const data = presence.data as { name?: string; color?: string };
        return (
          <span
            key={presence.id}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: data.color ?? "#64748b" }}
            />
            {data.name ?? "Collaborator"}
          </span>
        );
      })}
    </div>
  );
}
