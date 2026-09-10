import type { AtsResult, Game, Pick, Player, RecordLine, SeasonRow, Selection, Week, WeeklyBoard } from "./types";

export function outcomeFor(selection: Selection, ats: AtsResult | null): "W" | "L" | null {
  if (!ats) return null;
  if (ats === "push") return "L";
  if (ats === "home_cover") return selection === "home" ? "W" : "L";
  return selection === "away" ? "W" : "L";
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "—";
  return `${Math.round(pct * 1000) / 10}%`;
}

function lineFor(playerId: number, picks: Pick[], games: Game[]): RecordLine {
  let wins = 0;
  let losses = 0;
  let pending = 0;
  const gameById = new Map(games.map((g) => [g.id, g]));
  for (const p of picks.filter((x) => x.playerId === playerId)) {
    const g = gameById.get(p.gameId);
    if (!g) continue;
    const o = outcomeFor(p.selection, g.atsResult);
    if (o === "W") wins += 1;
    else if (o === "L") losses += 1;
    else pending += 1;
  }
  const decided = wins + losses;
  return {
    playerId,
    wins,
    losses,
    pending,
    pct: decided === 0 ? -1 : wins / decided,
  };
}

export function buildSeason(players: Player[], weeks: Week[], games: Game[], picks: Pick[]): SeasonRow[] {
  const rows: SeasonRow[] = players.map((player) => {
    const weekly = weeks.map((week) => {
      const weekGames = games.filter((g) => g.weekId === week.id);
      const weekPicks = picks.filter((p) => p.playerId === player.id && p.weekId === week.id);
      const rec = lineFor(player.id, weekPicks, weekGames);
      return { weekNumber: week.weekNumber, wins: rec.wins, losses: rec.losses, pending: rec.pending };
    });
    const wins = weekly.reduce((s, w) => s + w.wins, 0);
    const losses = weekly.reduce((s, w) => s + w.losses, 0);
    const pending = weekly.reduce((s, w) => s + w.pending, 0);
    const decided = wins + losses;
    return {
      playerId: player.id,
      wins,
      losses,
      pending,
      pct: decided === 0 ? -1 : wins / decided,
      rank: 0,
      tied: false,
      weekly,
    };
  });
  rows.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
  rows.forEach((row, i) => {
    row.rank = i + 1;
    if (i > 0 && rows[i - 1].pct === row.pct && row.pct >= 0) {
      row.tied = true;
      rows[i - 1].tied = true;
      row.rank = rows[i - 1].rank;
    }
  });
  return rows;
}

export function buildWeeklyBoard(week: Week, games: Game[], picks: Pick[], players: Player[]): WeeklyBoard {
  const weekGames = games.filter((g) => g.weekId === week.id);
  const weekPicks = picks.filter((p) => p.weekId === week.id);
  const records = players.map((player) => lineFor(player.id, weekPicks, weekGames));
  const decided = records.filter((r) => r.pct >= 0);
  const best = decided.length ? Math.max(...decided.map((r) => r.pct)) : -1;
  const leaders = decided.filter((r) => r.pct === best);
  return {
    week,
    games: weekGames.slice().sort((a, b) => a.gameNumber - b.gameNumber),
    records: records.map((r) => ({
      ...r,
      highlight: r.pct < 0 || r.pct !== best ? null : leaders.length > 1 ? "tie" : "lead",
    })),
  };
}
