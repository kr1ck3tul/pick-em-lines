import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PICKS_PER_WEEK, type Game, type PoolSnapshot, type Selection } from "@/lib/pool/types";
import { canEnterPicks } from "@/lib/pool/gates";
import { usePoolMutations } from "@/lib/pool/queries";
import { cn, formatSpread } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GameLine, StatusBadge, WeekSwitcher } from "@/components/week-board";
import { BackupButton } from "@/components/backup-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import { downloadPlayerCardsPdf } from "@/lib/pool/pdf";

type Draft = Record<number, Selection>;

export function PickBuilder({
  pool,
  weekNumber,
  initialPlayerId,
}: {
  pool: PoolSnapshot;
  weekNumber: number;
  initialPlayerId?: number;
}) {
  const mut = usePoolMutations();
  const week = pool.weeks.find((w) => w.weekNumber === weekNumber);
  const games = pool.games.filter((g) => g.weekId === week?.id).sort((a, b) => a.gameNumber - b.gameNumber);
  const playerId =
    (initialPlayerId && pool.players.some((p) => p.id === initialPlayerId) && initialPlayerId) || pool.players[0]?.id;

  const existing = useMemo(() => {
    const d: Draft = {};
    if (!playerId || !week) return d;
    for (const p of pool.picks) {
      if (p.playerId === playerId && p.weekId === week.id) d[p.gameId] = p.selection;
    }
    return d;
  }, [playerId, week, pool.picks]);

  const [draft, setDraft] = useState<Draft>(existing);
  const [draftFor, setDraftFor] = useState(`${playerId ?? 0}:${week?.id ?? 0}`);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const draftKey = `${playerId ?? 0}:${week?.id ?? 0}`;
  const skipSave = useRef(true);

  if (draftKey !== draftFor) {
    setDraft(existing);
    setDraftFor(draftKey);
    skipSave.current = true;
    setSaveState("idle");
  }

  const selected = Object.entries(draft).map(([gameId, selection]) => ({ gameId: Number(gameId), selection }));
  const count = selected.length;
  const player = pool.players.find((p) => p.id === playerId);
  const picksOpen = canEnterPicks(week?.status ?? "upcoming");

  useEffect(() => {
    if (!picksOpen || !playerId || !week) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveState("saving");
    const handle = window.setTimeout(() => {
      void mut.savePicks
        .mutateAsync({ weekNumber, playerId, picks: selected })
        .then(() => setSaveState("saved"))
        .catch((err) => {
          setSaveState("idle");
          toast.error(err instanceof Error ? err.message : "Could not save picks.");
        });
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, draftKey]);

  function toggle(game: Game, selection: Selection) {
    if (!picksOpen) return;
    setDraft((prev) => {
      const next = { ...prev };
      if (next[game.id] === selection) {
        delete next[game.id];
        return next;
      }
      if (!next[game.id] && Object.keys(next).length >= PICKS_PER_WEEK) {
        toast.message(`Already ${PICKS_PER_WEEK} games. Deselect one first.`);
        return prev;
      }
      next[game.id] = selection;
      return next;
    });
  }

  if (!week) return <p className="text-sm text-muted-foreground">Unknown week.</p>;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{week.label}</p>
        <h1 className="font-display text-4xl tracking-tight">Enter picks</h1>
        <StatusBadge status={week.status} />
      </header>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <WeekSwitcher current={weekNumber} to="/picks" playerId={playerId} />
        <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!picksOpen || !playerId || mut.resetPlayerPicks.isPending}
            onClick={async () => {
              if (!playerId) return;
              if (!confirm(`Clear ${player?.name ?? "this player"}’s Week ${weekNumber} card?`)) return;
              try {
                skipSave.current = true;
                await mut.resetPlayerPicks.mutateAsync({ weekNumber, playerId });
                setDraft({});
                setSaveState("idle");
                toast.message(`${player?.name ?? "Player"}’s card cleared.`);
              } catch (err) {
                skipSave.current = false;
                toast.error(err instanceof Error ? err.message : "Could not reset.");
              }
            }}
          >
            {mut.resetPlayerPicks.isPending ? "Resetting…" : "Reset pick grid"}
          </Button>
          <DownloadPdfButton label="Print Cards" onDownload={() => downloadPlayerCardsPdf(pool, weekNumber, "all")} />
          <BackupButton />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Player</p>
        <div className="flex w-full min-w-0 flex-wrap gap-1">
          {pool.players.map((p) => (
            <Link
              key={p.id}
              to="/picks"
              search={{ week: weekNumber, player: p.id }}
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                p.id === playerId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="font-medium">{player?.name ?? "Player"}</p>
        <p className={cn("font-mono text-sm tabular-nums", count === PICKS_PER_WEEK ? "text-win-foreground" : "text-muted-foreground")}>
          {count} / {PICKS_PER_WEEK}
        </p>
        <p className="text-xs text-muted-foreground">
          {!picksOpen ? "Picks frozen" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Changes save automatically"}
        </p>
      </div>

      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games posted for this week yet.</p>
      ) : (
        <ul className="space-y-2">
          {games.map((game) => {
            const sel = draft[game.id];
            const frozen = !picksOpen;
            const atCap = !sel && count >= PICKS_PER_WEEK;
            return (
              <li key={game.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <GameLine game={game} />
                  <div className="grid grid-cols-2 gap-2 sm:w-72">
                    <SideButton
                      active={sel === "away"}
                      disabled={frozen || atCap}
                      onClick={() => toggle(game, "away")}
                      kicker="Away"
                      name={game.awayTeam}
                      spread={formatSpread(-game.homeSpread)}
                    />
                    <SideButton
                      active={sel === "home"}
                      disabled={frozen || atCap}
                      onClick={() => toggle(game, "home")}
                      kicker="Home"
                      name={game.homeTeam}
                      spread={formatSpread(game.homeSpread)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SideButton({
  active,
  disabled,
  onClick,
  kicker,
  name,
  spread,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  kicker: string;
  name: string;
  spread: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-left disabled:opacity-40",
        active ? "border-primary bg-primary/15" : "border-border bg-background hover:bg-muted",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{kicker}</p>
      <p className="truncate text-sm">{name}</p>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">{spread}</p>
    </button>
  );
}
