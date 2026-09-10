import type { PoolBackup } from "./backup";

async function loadXlsx() {
  return import("xlsx");
}

export async function downloadPoolBackupXlsx(backup: PoolBackup): Promise<void> {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["version", backup.version],
      ["exportedAt", backup.exportedAt],
      ["activeYear", backup.activeYear],
      ["settingsName", backup.settingsName],
    ]),
    "Meta",
  );
  const seasons = backup.seasons.map((s) => ({
    year: s.year,
    weekCount: s.weekCount,
    currentWeek: s.currentWeek,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(seasons), "Seasons");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.seasons.flatMap((s) => s.players.map((p) => ({ year: s.year, slot: p.slot, name: p.name }))),
    ),
    "Players",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.seasons.flatMap((s) =>
        s.weeks.map((w) => ({ year: s.year, weekNumber: w.weekNumber, status: w.status, label: w.label })),
      ),
    ),
    "Weeks",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.seasons.flatMap((s) =>
        s.games.map((g) => ({
          year: s.year,
          weekNumber: g.weekNumber,
          gameNumber: g.gameNumber,
          awayTeam: g.awayTeam,
          homeTeam: g.homeTeam,
          homeSpread: g.homeSpread,
          commenceTime: g.commenceTime,
          atsResult: g.atsResult,
        })),
      ),
    ),
    "Games",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      backup.seasons.flatMap((s) =>
        s.picks.map((p) => ({
          year: s.year,
          playerSlot: p.playerSlot,
          weekNumber: p.weekNumber,
          gameNumber: p.gameNumber,
          selection: p.selection,
        })),
      ),
    ),
    "Picks",
  );
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pick-em-lines-${backup.activeYear}-backup.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function parseBackupFile(file: File): Promise<PoolBackup> {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const metaRows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets.Meta, { header: 1 });
  const meta = Object.fromEntries(metaRows.map((r) => [String(r[0]), r[1]]));
  const seasonsSheet = XLSX.utils.sheet_to_json<{ year: number; weekCount: number; currentWeek: number }>(
    wb.Sheets.Seasons,
  );
  const players = XLSX.utils.sheet_to_json<{ year: number; slot: number; name: string }>(wb.Sheets.Players);
  const weeks = XLSX.utils.sheet_to_json<{ year: number; weekNumber: number; status: string; label: string }>(
    wb.Sheets.Weeks,
  );
  const games = XLSX.utils.sheet_to_json<{
    year: number;
    weekNumber: number;
    gameNumber: number;
    awayTeam: string;
    homeTeam: string;
    homeSpread: number;
    commenceTime: string | null;
    atsResult: string | null;
  }>(wb.Sheets.Games);
  const picks = XLSX.utils.sheet_to_json<{
    year: number;
    playerSlot: number;
    weekNumber: number;
    gameNumber: number;
    selection: string;
  }>(wb.Sheets.Picks);
  const seasons = seasonsSheet.map((s) => ({
    year: Number(s.year),
    weekCount: Number(s.weekCount),
    currentWeek: Number(s.currentWeek),
    players: players.filter((p) => Number(p.year) === Number(s.year)).map((p) => ({ slot: Number(p.slot), name: String(p.name) })),
    weeks: weeks
      .filter((w) => Number(w.year) === Number(s.year))
      .map((w) => ({ weekNumber: Number(w.weekNumber), status: String(w.status), label: String(w.label) })),
    games: games
      .filter((g) => Number(g.year) === Number(s.year))
      .map((g) => ({
        weekNumber: Number(g.weekNumber),
        gameNumber: Number(g.gameNumber),
        homeTeam: String(g.homeTeam),
        awayTeam: String(g.awayTeam),
        homeSpread: Number(g.homeSpread),
        commenceTime: g.commenceTime ? String(g.commenceTime) : null,
        atsResult: g.atsResult ? String(g.atsResult) : null,
      })),
    picks: picks
      .filter((p) => Number(p.year) === Number(s.year))
      .map((p) => ({
        playerSlot: Number(p.playerSlot),
        weekNumber: Number(p.weekNumber),
        gameNumber: Number(p.gameNumber),
        selection: String(p.selection),
      })),
  }));
  return {
    version: 1,
    exportedAt: String(meta.exportedAt ?? new Date().toISOString()),
    activeYear: Number(meta.activeYear ?? seasons[0]?.year ?? 2026),
    settingsName: String(meta.settingsName ?? "Pick 'em Lines"),
    seasons,
  };
}
