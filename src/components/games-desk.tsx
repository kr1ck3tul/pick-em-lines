import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { AtsResult, Game, PoolSnapshot } from "@/lib/pool/types";
import { canEditSlate, canFetchOdds, canGradeGames } from "@/lib/pool/gates";
import { BOOKMAKERS, DEFAULT_BOOKMAKER } from "@/lib/pool/odds";
import { usePoolMutations } from "@/lib/pool/queries";
import { parseSlateFile } from "@/lib/pool/slate";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GameLine, StatusBadge, WeekSwitcher } from "@/components/week-board";
import { BackupButton } from "@/components/backup-button";

export function GamesDesk({ pool, weekNumber }: { pool: PoolSnapshot; weekNumber: number }) {
  const mut = usePoolMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const [bookmaker, setBookmaker] = useState(DEFAULT_BOOKMAKER);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fbsOnly, setFbsOnly] = useState(true);
  const week = pool.weeks.find((w) => w.weekNumber === weekNumber);
  const games = pool.games.filter((g) => g.weekId === week?.id).sort((a, b) => a.gameNumber - b.gameNumber);
  if (!week) return <p className="text-sm text-muted-foreground">Unknown week.</p>;

  const slateOpen = canEditSlate(week.status);
  const gradingOpen = canGradeGames(week.status);
  const oddsOpen = canFetchOdds(week.status);
  const filtersOpen = slateOpen || oddsOpen;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl tracking-tight">{week.label}</h1>
        <StatusBadge status={week.status} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <WeekSwitcher current={weekNumber} to="/games" />
        <BackupButton />
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4">
        <p className="text-sm text-muted-foreground">
          From / To apply to Fetch odds. Upload Excel loads every game in the sheet. FBS vs FBS applies to both.
        </p>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label>Sportsbook</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={bookmaker}
              disabled={!oddsOpen}
              onChange={(e) => setBookmaker(e.target.value)}
            >
              {BOOKMAKERS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
            <DateField id="odds-from" label="From" value={fromDate} disabled={!filtersOpen} onChange={setFromDate} inputRef={fromRef} />
            <DateField id="odds-to" label="To" value={toDate} disabled={!filtersOpen} onChange={setToDate} inputRef={toRef} />
          </div>
        </div>
        <label className="mt-4 flex items-start justify-center gap-2 text-center text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-foreground"
            checked={fbsOnly}
            disabled={!filtersOpen}
            onChange={(e) => setFbsOnly(e.target.checked)}
          />
          <span>
            FBS vs FBS only
            <span className="block text-[11px] text-muted-foreground">Both Bowl Subdivision — skips FCS and D2</span>
          </span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!oddsOpen || mut.fetchOddsIntoWeek.isPending || !pool.settings.hasOddsKey}
            onClick={() => {
              void mut.fetchOddsIntoWeek
                .mutateAsync({
                  weekNumber,
                  bookmaker,
                  commenceFrom: fromDate || fromRef.current?.value || null,
                  commenceTo: toDate || toRef.current?.value || null,
                  fbsOnly,
                })
                .then((r) => toast.success(`Fetched ${r.added} games.`))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Fetch failed."));
            }}
          >
            {mut.fetchOddsIntoWeek.isPending ? "Fetching…" : "Fetch odds"}
          </Button>
          <Button type="button" variant="secondary" disabled={!slateOpen} onClick={() => fileRef.current?.click()}>
            Upload Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void parseSlateFile(file)
                .then((parsed) => mut.importSlateGames.mutateAsync({ weekNumber, games: parsed, fbsOnly }))
                .then((r) => toast.success(`Imported ${r.added} games.`))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not import."));
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!slateOpen || mut.resetWeekGames.isPending}
            onClick={() => {
              if (!confirm(`Clear Week ${weekNumber} games and picks?`)) return;
              void mut.resetWeekGames
                .mutateAsync(weekNumber)
                .then(() => toast.message(`Week ${weekNumber} games and picks cleared.`))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not reset."));
            }}
          >
            {mut.resetWeekGames.isPending ? "Resetting…" : "Reset week"}
          </Button>
        </div>
        {!pool.settings.hasOddsKey && (
          <p className="mt-3 text-xs text-muted-foreground">Save an Odds API key on Admin to fetch lines.</p>
        )}
      </div>

      <ul className="space-y-2">
        {games.map((game) => (
          <li key={game.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <GameLine game={game} />
                </div>
                <RemoveGameButton gameId={game.id} disabled={!slateOpen} className="lg:hidden" />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SpreadField game={game} disabled={!slateOpen} />
                <GradeButtons game={game} disabled={!gradingOpen} />
                <RemoveGameButton gameId={game.id} disabled={!slateOpen} className="hidden lg:inline-flex" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {games.length === 0 && <p className="text-sm text-muted-foreground">No games this week.</p>}
      <AddGameForm weekNumber={weekNumber} disabled={!slateOpen} />
    </div>
  );
}

function RemoveGameButton({ gameId, disabled, className }: { gameId: number; disabled: boolean; className?: string }) {
  const mut = usePoolMutations();
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn("size-8 shrink-0 text-muted-foreground hover:text-destructive", className)}
      disabled={disabled}
      aria-label="Remove game"
      onClick={() => {
        if (!confirm("Delete this game and any picks on it?")) return;
        void mut.deleteGame.mutateAsync(gameId).catch((err) => toast.error(err instanceof Error ? err.message : "Could not delete."));
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function GradeButtons({ game, disabled }: { game: Game; disabled: boolean }) {
  const mut = usePoolMutations();
  function setAts(next: AtsResult) {
    const ats = game.atsResult === next ? null : next;
    void mut.setAtsResult.mutateAsync({ gameId: game.id, atsResult: ats }).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Could not grade."),
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {(
        [
          ["home_cover", "Home"],
          ["away_cover", "Away"],
          ["push", "Tie"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={game.atsResult === value ? "default" : "outline"}
          disabled={disabled || mut.setAtsResult.isPending}
          onClick={() => setAts(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function SpreadField({ game, disabled }: { game: Game; disabled: boolean }) {
  const mut = usePoolMutations();
  const [value, setValue] = useState(String(game.homeSpread));
  const [synced, setSynced] = useState(game.homeSpread);
  if (game.homeSpread !== synced) {
    setValue(String(game.homeSpread));
    setSynced(game.homeSpread);
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n)) {
          toast.error("Spread must be a number.");
          return;
        }
        void mut.setHomeSpread.mutateAsync({ gameId: game.id, homeSpread: n }).catch((err) =>
          toast.error(err instanceof Error ? err.message : "Could not save spread."),
        );
      }}
    >
      <Label className="sr-only">Home spread</Label>
      <Input className="h-8 w-20 font-mono" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" size="sm" variant="secondary" disabled={disabled}>
        Set
      </Button>
    </form>
  );
}

function DateField({
  id,
  label,
  value,
  disabled,
  onChange,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="min-w-0 space-y-1.5 overflow-hidden">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef as RefObject<HTMLInputElement>}
        id={id}
        type="date"
        className="min-w-0 text-center"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AddGameForm({ weekNumber, disabled }: { weekNumber: number; disabled: boolean }) {
  const mut = usePoolMutations();
  const [away, setAway] = useState("");
  const [home, setHome] = useState("");
  const [spread, setSpread] = useState("");
  return (
    <form
      className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const homeSpread = spread.trim() === "" ? 0 : Number(spread);
        if (!Number.isFinite(homeSpread)) {
          toast.error("Spread must be a number.");
          return;
        }
        void mut.upsertGame
          .mutateAsync({ weekNumber, awayTeam: away, homeTeam: home, homeSpread })
          .then(() => {
            setAway("");
            setHome("");
            setSpread("");
            toast.success("Game added.");
          })
          .catch((err) => toast.error(err instanceof Error ? err.message : "Could not add."));
      }}
    >
      <div className="space-y-1.5">
        <Label>Away</Label>
        <Input value={away} disabled={disabled} onChange={(e) => setAway(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Home</Label>
        <Input value={home} disabled={disabled} onChange={(e) => setHome(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Home spread</Label>
        <Input className="font-mono" value={spread} disabled={disabled} onChange={(e) => setSpread(e.target.value)} />
      </div>
      <Button type="submit" disabled={disabled || mut.upsertGame.isPending}>
        Add game
      </Button>
    </form>
  );
}
