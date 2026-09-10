import { useRef, useState } from "react";
import { toast } from "sonner";
import { WEEK_STATUS_LABEL } from "@/lib/pool/gates";
import { MAX_WEEKS, MIN_WEEKS, type PoolSnapshot, type WeekStatus } from "@/lib/pool/types";
import { usePoolMutations } from "@/lib/pool/queries";
import { getPoolBackup } from "@/lib/pool/server";
import { downloadPoolBackupXlsx, parseBackupFile } from "@/lib/pool/excel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RosterPanel } from "@/components/roster-panel";

const STATUSES = ["upcoming", "open", "locked", "final"] as const;

export function DeskPanel({ pool }: { pool: PoolSnapshot }) {
  const mut = usePoolMutations();
  const [key, setKey] = useState("");
  const [weekCount, setWeekCount] = useState(String(pool.settings.weekCount));
  const [syncedWeeks, setSyncedWeeks] = useState(pool.settings.weekCount);
  const [newYear, setNewYear] = useState(String(pool.settings.season + 1));
  const [exporting, setExporting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetYear, setResetYear] = useState("");
  const [resetScope, setResetScope] = useState<"picks" | "games" | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  if (pool.settings.weekCount !== syncedWeeks) {
    setWeekCount(String(pool.settings.weekCount));
    setSyncedWeeks(pool.settings.weekCount);
  }

  function openReset(scope: "picks" | "games" | "all") {
    setResetScope(scope);
    setResetYear("");
    setResetOpen(true);
  }

  const resetCopy =
    resetScope === "picks"
      ? `Clears every player’s picks in ${pool.settings.season}. Games and week status stay.`
      : resetScope === "games"
        ? `Clears every game in ${pool.settings.season}, and the picks on those games. Week status stays.`
        : `Clears every game and pick in ${pool.settings.season}. All weeks go back to Upcoming. Roster stays.`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Admin</h1>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <form
          className="grid gap-4 sm:grid-cols-2 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(weekCount);
            if (!Number.isInteger(n) || n < MIN_WEEKS || n > MAX_WEEKS) {
              toast.error(`Weeks must be ${MIN_WEEKS}–${MAX_WEEKS}.`);
              return;
            }
            if (n < pool.settings.weekCount) {
              if (!confirm(`Remove weeks ${n + 1}–${pool.settings.weekCount} and their games and picks?`)) return;
            }
            void mut.setWeekCount
              .mutateAsync(n)
              .then(() => toast.success(`${n} weeks.`))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update weeks."));
          }}
        >
          <div className="space-y-1.5">
            <Label>Season</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={String(pool.settings.seasonId)}
              onChange={(e) => {
                void mut.switchSeason
                  .mutateAsync(Number(e.target.value))
                  .then(() => toast.success("Season switched."))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not switch."));
              }}
            >
              {pool.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="week-count">Weeks in season</Label>
              <Input id="week-count" className="font-mono" inputMode="numeric" value={weekCount} onChange={(e) => setWeekCount(e.target.value)} />
            </div>
            <Button type="submit" disabled={mut.setWeekCount.isPending}>
              Save
            </Button>
          </div>
        </form>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-2xl">Backup</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={exporting}
              onClick={() => {
                setExporting(true);
                void getPoolBackup()
                  .then((backup) => downloadPoolBackupXlsx(backup))
                  .then(() => toast.success("Excel backup downloaded."))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not export."))
                  .finally(() => setExporting(false));
              }}
            >
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
            <Button type="button" variant="outline" disabled={mut.importBackup.isPending} onClick={() => fileRef.current?.click()}>
              {mut.importBackup.isPending ? "Importing…" : "Import Excel"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void parseBackupFile(file)
                  .then((backup) => mut.importBackup.mutateAsync(backup))
                  .then(() => toast.success("Backup restored."))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not import."));
              }}
            />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-2xl">Reset</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => openReset("picks")}>
              Reset picks
            </Button>
            <Button type="button" variant="outline" onClick={() => openReset("games")}>
              Reset games
            </Button>
            <Button type="button" variant="outline" onClick={() => openReset("all")}>
              Reset all
            </Button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <h2 className="font-display text-2xl">Add a season</h2>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void mut.createSeason
                .mutateAsync({ year: Number(newYear), weekCount: Number(weekCount) || 13 })
                .then(() => toast.success(`${newYear} added.`))
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not add season."));
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>Year</Label>
              <Input className="font-mono" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" disabled={mut.createSeason.isPending}>
              Add
            </Button>
          </form>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-2xl">Odds API</h2>
            {pool.settings.hasOddsKey && (
              <p className="font-mono text-xs text-muted-foreground">On file · •••• {pool.settings.oddsKeyLast4}</p>
            )}
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void mut.saveOddsKey
                .mutateAsync(key)
                .then(() => {
                  setKey("");
                  toast.success(key.trim() ? "Key saved." : "Key cleared.");
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save key."));
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="odds-key">API key</Label>
              <Input
                id="odds-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={pool.settings.hasOddsKey ? "New key, or blank to clear" : "Paste key"}
              />
            </div>
            <Button type="submit" disabled={mut.saveOddsKey.isPending}>
              Save
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-1">
        <h2 className="font-display text-2xl">Weeks</h2>
        <ul className="divide-y divide-border">
          {pool.weeks.map((week) => (
            <li key={week.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">{week.label}</p>
                {pool.settings.currentWeek === week.weekNumber && (
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Current</p>
                )}
              </div>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={week.status}
                onChange={(e) => {
                  const status = e.target.value as WeekStatus;
                  void mut.setWeekStatus
                    .mutateAsync({ weekNumber: week.weekNumber, status, makeCurrent: status === "open" })
                    .then(() => toast.success(`${week.label}: ${WEEK_STATUS_LABEL[status]}`))
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update week."));
                }}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {WEEK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <RosterPanel pool={pool} embedded />
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {pool.settings.season}?</DialogTitle>
            <DialogDescription>{resetCopy} Password is the season year.</DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void mut.resetSeason
                .mutateAsync({ year: resetYear, scope: resetScope })
                .then(() => {
                  setResetOpen(false);
                  toast.success("Reset complete.");
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : "Could not reset."));
            }}
          >
            <Input type="password" autoComplete="off" value={resetYear} onChange={(e) => setResetYear(e.target.value)} placeholder="Password" />
            <Button type="submit" disabled={mut.resetSeason.isPending}>
              Confirm reset
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
