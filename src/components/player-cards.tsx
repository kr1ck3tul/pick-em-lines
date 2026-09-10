import { PICKS_PER_WEEK, type Game, type Player, type PoolSnapshot, type Selection } from "@/lib/pool/types";
import { formatRecord, outcomeFor } from "@/lib/pool/scoring";
import { cn, formatSpread, schoolName } from "@/lib/utils";

export function sideName(game: Game, sel: Selection) {
  return schoolName(sel === "home" ? game.homeTeam : game.awayTeam);
}
export function sideSpread(game: Game, sel: Selection) {
  return formatSpread(sel === "home" ? game.homeSpread : -game.homeSpread);
}

function PickLines({
  picks,
  gameById,
}: {
  picks: { gameId: number; selection: Selection }[];
  gameById: Map<number, Game>;
}) {
  if (picks.length === 0) {
    return (
      <ol className="mt-3 space-y-1.5">
        {Array.from({ length: PICKS_PER_WEEK }, (_, i) => (
          <li key={i} className="border-b border-dashed border-border py-1.5 font-mono text-xs">
            {i + 1}. ID ______ &nbsp; H / A
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="mt-3 space-y-1">
      {picks.map((p, i) => {
        const g = gameById.get(p.gameId);
        if (!g) return null;
        const o = outcomeFor(p.selection, g.atsResult);
        return (
          <li key={p.gameId} className="grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_auto] items-baseline gap-1.5 text-sm">
            <span className="text-[11px] text-muted-foreground">{i + 1}.</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">#{g.gameNumber}</span>
            <span className="min-w-0 truncate">{sideName(g, p.selection)}</span>
            <span
              className={cn(
                "shrink-0 font-mono text-[11px] tabular-nums",
                o === "W" && "text-win-foreground",
                o === "L" && "text-loss-foreground",
                !o && "text-muted-foreground",
              )}
            >
              {sideSpread(g, p.selection)}
              {o ? ` ${o}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PlayerCards({
  pool,
  weekNumber,
  games,
  cards,
}: {
  pool: PoolSnapshot;
  weekNumber: number;
  games: Game[];
  cards: { player: Player; picks: { gameId: number; selection: Selection }[] }[];
}) {
  const gameById = new Map(games.map((g) => [g.id, g]));
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
      {cards.map(({ player, picks }) => {
        const season = pool.season.find((r) => r.playerId === player.id);
        const weekly = season?.weekly.find((w) => w.weekNumber === weekNumber);
        return (
          <article key={player.id} className="rounded-xl border border-border bg-card p-3">
            <h2 className="truncate font-display text-xl tracking-tight">{player.name}</h2>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              Week {formatRecord(weekly?.wins ?? 0, weekly?.losses ?? 0)} · Season {formatRecord(season?.wins ?? 0, season?.losses ?? 0)}
            </p>
            <PickLines picks={picks} gameById={gameById} />
          </article>
        );
      })}
    </div>
  );
}

export function PlayerSeasonBook({ pool, playerId }: { pool: PoolSnapshot; playerId: number }) {
  const player = pool.players.find((p) => p.id === playerId);
  const season = pool.season.find((r) => r.playerId === playerId);
  const gameById = new Map(pool.games.map((g) => [g.id, g]));
  if (!player) return null;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl tracking-tight">{player.name}</h2>
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          Season {formatRecord(season?.wins ?? 0, season?.losses ?? 0)}
        </p>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        {pool.weeks.map((week) => {
          const weekly = season?.weekly.find((w) => w.weekNumber === week.weekNumber);
          const picks = pool.picks
            .filter((p) => p.playerId === player.id && p.weekId === week.id)
            .slice()
            .sort((a, b) => (gameById.get(a.gameId)?.gameNumber ?? 0) - (gameById.get(b.gameId)?.gameNumber ?? 0));
          return (
            <article key={week.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg tracking-tight">{week.label}</h3>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatRecord(weekly?.wins ?? 0, weekly?.losses ?? 0)}
                </p>
              </div>
              {picks.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No card</p>
              ) : (
                <PickLines picks={picks} gameById={gameById} />
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
