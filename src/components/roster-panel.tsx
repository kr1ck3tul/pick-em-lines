import { useState } from "react";
import { toast } from "sonner";
import type { Player, PoolSnapshot } from "@/lib/pool/types";
import { usePoolMutations } from "@/lib/pool/queries";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RosterPanel({ pool, embedded = false }: { pool: PoolSnapshot; embedded?: boolean }) {
  const mut = usePoolMutations();
  const [rosterSeasonId, setRosterSeasonId] = useState(pool.settings.seasonId);
  const rosters = pool.rosters?.length
    ? pool.rosters
    : [{ seasonId: pool.settings.seasonId, year: pool.settings.season, players: pool.players }];
  const known = rosters.some((r) => r.seasonId === rosterSeasonId);
  const activeId = known ? rosterSeasonId : pool.settings.seasonId;
  const roster = rosters.find((r) => r.seasonId === activeId) ?? rosters[0];
  const players = roster?.players ?? pool.players;
  const year = roster?.year ?? pool.settings.season;

  return (
    <div className={embedded ? "space-y-3" : "space-y-8"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {embedded ? <h2 className="font-display text-2xl">Roster</h2> : <h1 className="font-display text-4xl tracking-tight">Roster</h1>}
        <div className="w-36 space-y-1.5">
          <Label htmlFor="roster-season">Season</Label>
          <select
            id="roster-season"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={String(activeId)}
            onChange={(e) => setRosterSeasonId(Number(e.target.value))}
          >
            {rosters.map((r) => (
              <option key={r.seasonId} value={r.seasonId}>
                {r.year}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ol className="overflow-hidden rounded-xl border border-border bg-card">
        {players.map((player) => (
          <RosterRow
            key={player.id}
            player={player}
            busy={mut.renamePlayer.isPending}
            onRename={async (name) => {
              try {
                await mut.renamePlayer.mutateAsync({ playerId: player.id, name });
                toast.success("Name saved.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not rename.");
              }
            }}
          />
        ))}
      </ol>
    </div>
  );
}

function RosterRow({
  player,
  busy,
  onRename,
}: {
  player: Player;
  busy: boolean;
  onRename: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(player.name);
  return (
    <li className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0">
      <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{player.slot}</span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px]">{initials(player.name)}</span>
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== player.name) void onRename(name.trim());
        }}
      >
        <Input className="min-w-0 flex-1" value={name} onChange={(e) => setName(e.target.value)} aria-label={`Name for slot ${player.slot}`} />
        <Button type="submit" variant="secondary" size="sm" className="shrink-0" disabled={busy || name.trim() === player.name}>
          Save
        </Button>
      </form>
    </li>
  );
}
