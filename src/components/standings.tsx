import { formatPct, formatRecord } from "@/lib/pool/scoring";
import { downloadStandingsPdf } from "@/lib/pool/pdf";
import type { Player, PoolSnapshot, SeasonRow } from "@/lib/pool/types";
import { cn, initials } from "@/lib/utils";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { BackupButton } from "@/components/backup-button";

function playerName(players: Player[], id: number) {
  return players.find((p) => p.id === id)?.name ?? "—";
}

function weekLeaderIds(season: SeasonRow[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  const weeks = season[0]?.weekly.map((w) => w.weekNumber) ?? [];
  for (const weekNumber of weeks) {
    const lines = season.map((row) => {
      const w = row.weekly.find((x) => x.weekNumber === weekNumber);
      const wins = w?.wins ?? 0;
      const losses = w?.losses ?? 0;
      const decided = wins + losses;
      return { playerId: row.playerId, pct: decided === 0 ? -1 : wins / decided };
    });
    const eligible = lines.filter((l) => l.pct >= 0);
    const best = eligible.length ? Math.max(...eligible.map((l) => l.pct)) : -1;
    map.set(weekNumber, new Set(eligible.filter((l) => l.pct === best && best >= 0).map((l) => l.playerId)));
  }
  return map;
}

export function Standings({ pool }: { pool: PoolSnapshot }) {
  const { season, players, settings } = pool;
  const leader = season[0];
  const leaderName = leader ? playerName(players, leader.playerId) : null;
  const leaders = weekLeaderIds(season);
  const seasonBest = season.filter((r) => r.rank === 1 && r.wins + r.losses > 0);

  return (
    <div className="min-w-0 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{settings.season} season</p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Season standings</h1>
          {leader && leader.wins + leader.losses > 0 ? (
            <p className="text-sm">
              {leader.tied ? (
                <>Tied at the top at {formatRecord(leader.wins, leader.losses)}.</>
              ) : (
                <>
                  <span className="font-medium">{leaderName}</span> leads at{" "}
                  <span className="font-mono tabular-nums">{formatRecord(leader.wins, leader.losses)}</span>.
                </>
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DownloadPdfButton size="default" onDownload={() => downloadStandingsPdf(pool)} />
          <BackupButton size="default" />
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[2.25rem_7.5rem_3.5rem_3rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground lg:grid">
          <span>Rk</span>
          <span>Player</span>
          <span className="text-right">W–L</span>
          <span className="text-right">Pct</span>
          <span className="text-center">By week</span>
        </div>
        <ol>
          {season.map((row) => {
            const name = playerName(players, row.playerId);
            const seasonLead = seasonBest.some((r) => r.playerId === row.playerId);
            return (
              <li key={row.playerId} className="border-b border-border px-3 py-3 last:border-b-0">
                <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[2.25rem_7.5rem_3.5rem_3rem_minmax(0,1fr)]">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{row.rank}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px]">
                      {initials(name)}
                    </span>
                    <span className="truncate font-medium">{name}</span>
                  </div>
                  <span className={cn("text-right font-mono text-sm tabular-nums", seasonLead && "text-win-foreground")}>
                    {formatRecord(row.wins, row.losses)}
                  </span>
                  <span className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground lg:block">
                    {formatPct(row.pct)}
                  </span>
                  <div className="col-span-3 mt-2 flex flex-wrap justify-center gap-1 lg:col-span-1 lg:mt-0">
                    {row.weekly.map((w) => {
                      const lead = leaders.get(w.weekNumber)?.has(row.playerId);
                      return (
                        <span
                          key={w.weekNumber}
                          className={cn(
                            "min-w-10 text-center font-mono text-[11px] tabular-nums text-muted-foreground",
                            lead && "text-win-foreground",
                          )}
                          title={`Week ${w.weekNumber}`}
                        >
                          {formatRecord(w.wins, w.losses)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
