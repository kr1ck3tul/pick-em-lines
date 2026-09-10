import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { downloadPlayerCardsPdf, downloadWeekSlatePdf } from "@/lib/pool/pdf";
import { type Game, type PoolSnapshot } from "@/lib/pool/types";
import { canEnterPicks } from "@/lib/pool/gates";
import { usePool } from "@/lib/pool/queries";
import { cn, formatSpread } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { PlayerCards, PlayerSeasonBook } from "@/components/player-cards";
import { BackupButton } from "@/components/backup-button";

function kickLabel(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);
}

export function GameLine({ game }: { game: Game }) {
  const result =
    game.atsResult === "home_cover"
      ? `${game.homeTeam} covers`
      : game.atsResult === "away_cover"
        ? `${game.awayTeam} covers`
        : game.atsResult === "push"
          ? "Push · loss"
          : null;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="w-8 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {game.gameNumber}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug break-words">
          <span className="text-muted-foreground">{game.awayTeam}</span>
          <span className="mx-1.5 text-muted-foreground">@</span>
          <span>{game.homeTeam}</span>
        </p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          Home {formatSpread(game.homeSpread)} · {kickLabel(game.commenceTime)}
        </p>
        {result && <p className="mt-0.5 text-xs text-muted-foreground">{result}</p>}
      </div>
    </div>
  );
}

export function WeekBoard({ pool, weekNumber }: { pool: PoolSnapshot; weekNumber: number }) {
  const week = pool.weeks.find((w) => w.weekNumber === weekNumber);
  const board = pool.weeklyBoards.find((b) => b.week.weekNumber === weekNumber);
  const [cardPlayer, setCardPlayer] = useState<number | "all">("all");
  if (!week || !board) return <p className="text-sm text-muted-foreground">That week does not exist.</p>;
  const games = board.games;
  const list = cardPlayer === "all" ? pool.players : pool.players.filter((p) => p.id === cardPlayer);
  const cards = list.map((player) => {
    const picks = pool.picks
      .filter((p) => p.playerId === player.id && p.weekId === week.id)
      .slice()
      .sort((a, b) => (games.find((g) => g.id === a.gameId)?.gameNumber ?? 0) - (games.find((g) => g.id === b.gameId)?.gameNumber ?? 0));
    return { player, picks };
  });

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-3">
        <h1 className="font-display text-4xl tracking-tight">{week.label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={week.status} />
          <span className="text-sm text-muted-foreground">{games.length} games</span>
        </div>
      </header>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <WeekSwitcher current={weekNumber} />
        <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
          {canEnterPicks(week.status) && (
            <Button asChild variant="secondary" size="sm">
              <Link to="/picks" search={{ week: weekNumber }}>
                Enter picks
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => document.getElementById("player-cards")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Player Cards
          </Button>
          <BackupButton />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Slate</h2>
          <DownloadPdfButton label="Print Slate" onDownload={() => downloadWeekSlatePdf(pool, weekNumber)} />
        </div>
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games this week.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {games.map((g) => (
              <div key={g.id} className="min-w-0 rounded-lg border border-border bg-card p-3">
                <GameLine game={g} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="player-cards" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Player cards</h2>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <select
              className="h-9 w-48 rounded-md border border-border bg-background px-3 text-sm"
              value={cardPlayer === "all" ? "all" : String(cardPlayer)}
              onChange={(e) => setCardPlayer(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">All {pool.players.length} players</option>
              {pool.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <DownloadPdfButton label="Print Cards" onDownload={() => downloadPlayerCardsPdf(pool, weekNumber, cardPlayer)} />
          </div>
        </div>
        {cardPlayer === "all" ? (
          <PlayerCards pool={pool} weekNumber={weekNumber} games={games} cards={cards} />
        ) : (
          <PlayerSeasonBook pool={pool} playerId={cardPlayer} />
        )}
      </section>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "open") return <Badge variant="open">Open for picks</Badge>;
  if (status === "locked") return <Badge variant="tie">Locked</Badge>;
  if (status === "final") return <Badge>Final</Badge>;
  return <Badge>Upcoming</Badge>;
}

export function WeekSwitcher({
  current,
  to = "/week/$weekNumber",
  playerId,
}: {
  current: number;
  to?: "/week/$weekNumber" | "/picks" | "/games";
  playerId?: number;
}) {
  const pool = usePool();
  const count = pool.data?.weeks.length ?? 13;
  return (
    <div className="no-print flex min-w-0 flex-1 flex-wrap gap-1">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const className = cn(
          "grid size-9 shrink-0 place-items-center rounded-md font-mono text-xs tabular-nums",
          n === current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
        );
        if (to === "/picks") {
          return (
            <Link key={n} to="/picks" search={{ week: n, player: playerId }} className={className}>
              {n}
            </Link>
          );
        }
        if (to === "/games") {
          return (
            <Link key={n} to="/games" search={{ week: n }} className={className}>
              {n}
            </Link>
          );
        }
        return (
          <Link key={n} to={to} params={{ weekNumber: String(n) }} className={className}>
            {n}
          </Link>
        );
      })}
    </div>
  );
}
