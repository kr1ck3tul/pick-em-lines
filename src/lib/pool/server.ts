import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { DEFAULT_ROSTER, MAX_WEEKS, MIN_WEEKS, PLAYER_COUNT, type AtsResult, type Game, type Pick, type Player, type PoolSnapshot, type Selection, type Week, type WeekStatus } from "./types";
import { buildSeason, buildWeeklyBoard } from "./scoring";
import { canEditSlate, canFetchOdds, canGradeGames } from "./gates";
import type { PoolBackup } from "./backup";
import { fetchNcaafOdds, homeSpreadFromEvent } from "./odds";
import { isFbsMatchup } from "./fbs";

type PlayerRow = { id: number; slot: number; name: string; season_id?: number };
type WeekRow = { id: number; week_number: number; status: WeekStatus; label: string };
type GameRow = {
  id: number;
  week_id: number;
  game_number: number;
  home_team: string;
  away_team: string;
  home_spread: string | number;
  commence_time: string | Date | null;
  odds_event_id: string | null;
  ats_result: AtsResult | null;
};
type PickRow = { player_id: number; week_id: number; game_id: number; selection: Selection };

function mapPlayer(r: PlayerRow): Player {
  return { id: r.id, slot: r.slot, name: r.name };
}
function mapWeek(r: WeekRow): Week {
  return { id: r.id, weekNumber: r.week_number, status: r.status, label: r.label };
}
function mapGame(r: GameRow): Game {
  const t = r.commence_time;
  return {
    id: r.id,
    weekId: r.week_id,
    gameNumber: r.game_number,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeSpread: Number(r.home_spread),
    commenceTime: t ? (t instanceof Date ? t.toISOString() : String(t)) : null,
    oddsEventId: r.odds_event_id,
    atsResult: r.ats_result,
  };
}
function mapPick(r: PickRow): Pick {
  return { playerId: r.player_id, weekId: r.week_id, gameId: r.game_id, selection: r.selection };
}
function last4(key: string | null | undefined): string | null {
  const s = key?.trim() ?? "";
  return s ? s.slice(-4) : null;
}

async function ensureSeeded(sql: Sql): Promise<void> {
  const settings = await sql<{ id: number }>`select id from pool_settings where id = 1`;
  if (settings.length === 0) {
    await sql`insert into pool_settings (id, name, season) values (1, ${"Pick 'em Lines"}, 2026)`;
  }
  let seasons = await sql<{ id: number; year: number }>`select id, year from seasons order by year`;
  if (seasons.length === 0) {
    await sql`insert into seasons (year, week_count, current_week) values (2026, 13, 1)`;
    seasons = await sql<{ id: number; year: number }>`select id, year from seasons order by year`;
  }
  const srow = await sql<{ current_season_id: number | null }>`select current_season_id from pool_settings where id = 1`;
  const active = seasons.find((s) => s.id === srow[0]?.current_season_id) ?? seasons.find((s) => s.year === 2026) ?? seasons[0];
  if (!active) return;
  await sql`update pool_settings set current_season_id = ${active.id}, season = ${active.year} where id = 1`;
  await fillSeason(sql, active.id, 13);
}

async function fillSeason(sql: Sql, seasonId: number, weekCount: number): Promise<void> {
  const players = await sql<{ id: number }>`select id from players where season_id = ${seasonId}`;
  if (players.length === 0) {
    for (let i = 0; i < PLAYER_COUNT; i++) {
      await sql`insert into players (season_id, slot, name) values (${seasonId}, ${i + 1}, ${DEFAULT_ROSTER[i] ?? `Player ${i + 1}`})`;
    }
  }
  const weeks = await sql<{ week_number: number }>`select week_number from weeks where season_id = ${seasonId}`;
  const have = new Set(weeks.map((w) => w.week_number));
  for (let n = 1; n <= weekCount; n++) {
    if (!have.has(n)) {
      await sql`insert into weeks (season_id, week_number, status, label) values (${seasonId}, ${n}, ${"upcoming"}, ${`Week ${n}`})`;
    }
  }
  await sql`delete from weeks where season_id = ${seasonId} and week_number > ${weekCount}`;
}

async function activeSeason(sql: Sql): Promise<{ id: number; year: number; week_count: number; current_week: number }> {
  await ensureSeeded(sql);
  const [s] = await sql<{ current_season_id: number | null }>`select current_season_id from pool_settings where id = 1`;
  const rows = await sql<{ id: number; year: number; week_count: number; current_week: number }>`
    select id, year, week_count, current_week from seasons order by year desc
  `;
  const active = rows.find((r) => r.id === s?.current_season_id) ?? rows[0];
  if (!active) throw new Error("No seasons.");
  return active;
}

async function weekOf(sql: Sql, seasonId: number, weekNumber: number) {
  const [w] = await sql<WeekRow>`
    select id, week_number, status, label from weeks where season_id = ${seasonId} and week_number = ${weekNumber}
  `;
  if (!w) throw new Error("Unknown week.");
  return w;
}

async function nextGameNumber(sql: Sql, seasonId: number): Promise<number> {
  const [row] = await sql<{ n: number | null }>`
    select max(g.game_number) as n
    from games g
    join weeks w on w.id = g.week_id
    where w.season_id = ${seasonId}
  `;
  return (row?.n ?? 0) + 1;
}

async function loadSnapshot() {
  const sql = await getSql();
  await ensureSeeded(sql);
  const [s] = await sql<{
    name: string;
    season: number;
    current_week: number;
    odds_api_key: string | null;
    current_season_id: number | null;
  }>`select name, season, current_week, odds_api_key, current_season_id from pool_settings where id = 1`;
  if (!s) throw new Error("Pool is not initialized.");
  const seasonRows = await sql<{ id: number; year: number; week_count: number; current_week: number }>`
    select id, year, week_count, current_week from seasons order by year desc
  `;
  const seasons = seasonRows.map((r) => ({
    id: r.id,
    year: r.year,
    weekCount: r.week_count,
    currentWeek: r.current_week,
  }));
  const active = seasons.find((x) => x.id === s.current_season_id) ?? seasons[0];
  if (!active) throw new Error("No seasons.");

  const playerRows = await sql<PlayerRow>`select id, slot, name, season_id from players order by season_id, slot`;
  const rosters = seasons.map((sz) => ({
    seasonId: sz.id,
    year: sz.year,
    players: playerRows.filter((p) => p.season_id === sz.id).map(mapPlayer),
  }));
  const players = rosters.find((r) => r.seasonId === active.id)?.players ?? [];
  const weekRows = await sql<WeekRow>`
    select id, week_number, status, label from weeks where season_id = ${active.id} order by week_number
  `;
  const gameRows = await sql<GameRow>`
    select g.id, g.week_id, g.game_number, g.home_team, g.away_team, g.home_spread, g.commence_time, g.odds_event_id, g.ats_result
    from games g join weeks w on w.id = g.week_id
    where w.season_id = ${active.id}
    order by g.week_id, g.game_number
  `;
  const pickRows = await sql<PickRow>`
    select p.player_id, p.week_id, p.game_id, p.selection
    from picks p join weeks w on w.id = p.week_id
    where w.season_id = ${active.id}
  `;
  return {
    settings: {
      name: s.name,
      season: active.year,
      seasonId: active.id,
      currentWeek: active.currentWeek,
      weekCount: active.weekCount,
      hasOddsKey: Boolean(s.odds_api_key?.trim()),
      oddsKeyLast4: last4(s.odds_api_key),
    },
    seasons,
    players,
    rosters,
    weeks: weekRows.map(mapWeek),
    games: gameRows.map(mapGame),
    picks: pickRows.map(mapPick),
  };
}

export const getPool = createServerFn({ method: "GET" }).handler(async (): Promise<PoolSnapshot> => {
  const base = await loadSnapshot();
  return {
    ...base,
    season: buildSeason(base.players, base.weeks, base.games, base.picks),
    weeklyBoards: base.weeks.map((w) => buildWeeklyBoard(w, base.games, base.picks, base.players)),
  };
});

export const renamePlayer = createServerFn({ method: "POST" })
  .validator((d: { playerId: number; name: string }) => ({ playerId: d.playerId, name: d.name.trim() }))
  .handler(async ({ data }) => {
    if (!data.name) throw new Error("Name cannot be empty.");
    if (data.name.length > 40) throw new Error("Keep names under 40 characters.");
    const sql = await getSql();
    await sql`update players set name = ${data.name} where id = ${data.playerId}`;
    return { ok: true as const };
  });

export const setWeekStatus = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; status: WeekStatus; makeCurrent?: boolean }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    await sql`update weeks set status = ${data.status}, updated_at = now() where week_number = ${data.weekNumber} and season_id = ${season.id}`;
    if (data.makeCurrent) {
      await sql`update seasons set current_week = ${data.weekNumber} where id = ${season.id}`;
      await sql`update pool_settings set current_week = ${data.weekNumber}, updated_at = now() where id = 1`;
    }
    return { ok: true as const };
  });

export const setWeekCount = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data: n }) => {
    if (!Number.isInteger(n) || n < MIN_WEEKS || n > MAX_WEEKS) throw new Error(`Weeks must be ${MIN_WEEKS}–${MAX_WEEKS}.`);
    const sql = await getSql();
    const season = await activeSeason(sql);
    await sql`update seasons set week_count = ${n} where id = ${season.id}`;
    await fillSeason(sql, season.id, n);
    return { ok: true as const };
  });

export const switchSeason = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data: seasonId }) => {
    const sql = await getSql();
    const [row] = await sql<{ id: number; year: number }>`select id, year from seasons where id = ${seasonId}`;
    if (!row) throw new Error("Unknown season.");
    await sql`update pool_settings set current_season_id = ${row.id}, season = ${row.year}, updated_at = now() where id = 1`;
    return { ok: true as const };
  });

export const createSeason = createServerFn({ method: "POST" })
  .validator((d: { year: number; weekCount: number }) => d)
  .handler(async ({ data }) => {
    const year = Number(data.year);
    const weekCount = Number(data.weekCount);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Enter a valid year.");
    if (!Number.isInteger(weekCount) || weekCount < MIN_WEEKS || weekCount > MAX_WEEKS) throw new Error("Invalid week count.");
    const sql = await getSql();
    await ensureSeeded(sql);
    const existing = await sql<{ id: number }>`select id from seasons where year = ${year}`;
    if (existing.length) throw new Error(`${year} already exists.`);
    const prev = await activeSeason(sql);
    const inserted = await sql<{ id: number }>`
      insert into seasons (year, week_count, current_week) values (${year}, ${weekCount}, 1) returning id
    `;
    const id = inserted[0]!.id;
    await fillSeason(sql, id, weekCount);
    const prevPlayers = await sql<{ slot: number; name: string }>`select slot, name from players where season_id = ${prev.id}`;
    for (const p of prevPlayers) {
      await sql`update players set name = ${p.name} where season_id = ${id} and slot = ${p.slot}`;
    }
    return { ok: true as const, id };
  });

export const saveOddsKey = createServerFn({ method: "POST" })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const key = data.trim() || null;
    await sql`update pool_settings set odds_api_key = ${key}, updated_at = now() where id = 1`;
    return { ok: true as const };
  });

export const upsertGame = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; homeTeam: string; awayTeam: string; homeSpread: number; commenceTime?: string | null; gameId?: number }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, data.weekNumber);
    if (!canEditSlate(week.status)) throw new Error("This week is locked.");
    const home = data.homeTeam.trim();
    const away = data.awayTeam.trim();
    if (!home || !away) throw new Error("Need both teams.");
    if (data.gameId) {
      await sql`update games set home_team = ${home}, away_team = ${away}, home_spread = ${data.homeSpread}, commence_time = ${data.commenceTime ?? null} where id = ${data.gameId}`;
      return { ok: true as const };
    }
    const n = await nextGameNumber(sql, season.id);
    await sql`insert into games (week_id, game_number, home_team, away_team, home_spread, commence_time) values (${week.id}, ${n}, ${home}, ${away}, ${data.homeSpread}, ${data.commenceTime ?? null})`;
    return { ok: true as const };
  });

export const setHomeSpread = createServerFn({ method: "POST" })
  .validator((d: { gameId: number; homeSpread: number }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update games set home_spread = ${data.homeSpread} where id = ${data.gameId}`;
    return { ok: true as const };
  });

export const setAtsResult = createServerFn({ method: "POST" })
  .validator((d: { gameId: number; atsResult: AtsResult | null }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const [g] = await sql<{ week_id: number }>`select week_id from games where id = ${data.gameId}`;
    if (!g) throw new Error("Unknown game.");
    const [w] = await sql<{ status: WeekStatus }>`select status from weeks where id = ${g.week_id}`;
    if (!w || !canGradeGames(w.status)) throw new Error("Grade after the week is locked.");
    await sql`update games set ats_result = ${data.atsResult} where id = ${data.gameId}`;
    return { ok: true as const };
  });

export const deleteGame = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data: gameId }) => {
    const sql = await getSql();
    const [g] = await sql<{ week_id: number }>`select week_id from games where id = ${gameId}`;
    if (!g) return { ok: true as const };
    const [w] = await sql<{ status: WeekStatus }>`select status from weeks where id = ${g.week_id}`;
    if (!w || !canEditSlate(w.status)) throw new Error("This week is locked.");
    await sql`delete from picks where game_id = ${gameId}`;
    await sql`delete from games where id = ${gameId}`;
    return { ok: true as const };
  });

export const savePicks = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; playerId: number; picks: { gameId: number; selection: Selection }[] }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, data.weekNumber);
    if (week.status !== "upcoming" && week.status !== "open") throw new Error("Picks are frozen.");
    await sql`delete from picks where player_id = ${data.playerId} and week_id = ${week.id}`;
    for (const p of data.picks) {
      await sql`insert into picks (player_id, week_id, game_id, selection) values (${data.playerId}, ${week.id}, ${p.gameId}, ${p.selection})`;
    }
    return { ok: true as const };
  });

export const resetPlayerPicks = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; playerId: number }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, data.weekNumber);
    if (week.status !== "upcoming" && week.status !== "open") throw new Error("Picks are frozen.");
    await sql`delete from picks where player_id = ${data.playerId} and week_id = ${week.id}`;
    return { ok: true as const };
  });

export const resetWeekGames = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data: weekNumber }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, weekNumber);
    if (!canEditSlate(week.status)) throw new Error("Reset week only while Upcoming.");
    await sql`delete from picks where week_id = ${week.id}`;
    await sql`delete from games where week_id = ${week.id}`;
    return { ok: true as const };
  });

export const resetSeason = createServerFn({ method: "POST" })
  .validator((d: { year: string; scope: "picks" | "games" | "all" }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    if (data.year !== String(season.year)) throw new Error("Password does not match.");
    await sql`delete from picks where week_id in (select id from weeks where season_id = ${season.id})`;
    if (data.scope !== "picks") {
      await sql`delete from games where week_id in (select id from weeks where season_id = ${season.id})`;
    }
    if (data.scope === "all") {
      await sql`update weeks set status = 'upcoming' where season_id = ${season.id}`;
      await sql`update seasons set current_week = 1 where id = ${season.id}`;
      await sql`update pool_settings set current_week = 1, updated_at = now() where id = 1`;
    }
    return { ok: true as const, year: season.year, scope: data.scope };
  });

export const importSlateGames = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; games: { awayTeam: string; homeTeam: string; homeSpread: number; commenceTime: string | null }[]; fbsOnly?: boolean }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, data.weekNumber);
    if (!canEditSlate(week.status)) throw new Error("This week is locked.");
    let n = await nextGameNumber(sql, season.id);
    let added = 0;
    for (const g of data.games) {
      if (data.fbsOnly && !isFbsMatchup(g.awayTeam, g.homeTeam)) continue;
      await sql`insert into games (week_id, game_number, home_team, away_team, home_spread, commence_time) values (${week.id}, ${n}, ${g.homeTeam}, ${g.awayTeam}, ${g.homeSpread}, ${g.commenceTime})`;
      n += 1;
      added += 1;
    }
    return { ok: true as const, added };
  });

export const fetchOddsIntoWeek = createServerFn({ method: "POST" })
  .validator((d: { weekNumber: number; bookmaker: string; commenceFrom?: string | null; commenceTo?: string | null; fbsOnly?: boolean }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const season = await activeSeason(sql);
    const week = await weekOf(sql, season.id, data.weekNumber);
    if (!canFetchOdds(week.status)) throw new Error("Fetch only works while the week is Upcoming.");
    const [s] = await sql<{ odds_api_key: string | null }>`select odds_api_key from pool_settings where id = 1`;
    const key = s?.odds_api_key?.trim();
    if (!key) throw new Error("Save an Odds API key in Admin first.");
    const events = await fetchNcaafOdds({
      apiKey: key,
      bookmaker: data.bookmaker,
      commenceFrom: data.commenceFrom,
      commenceTo: data.commenceTo,
    });
    let n = await nextGameNumber(sql, season.id);
    let added = 0;
    for (const ev of events) {
      if (data.fbsOnly && !isFbsMatchup(ev.away_team, ev.home_team)) continue;
      const spread = homeSpreadFromEvent(ev, data.bookmaker);
      if (spread == null) continue;
      const existing = await sql<{ id: number }>`select id from games where odds_event_id = ${ev.id} and week_id = ${week.id}`;
      if (existing.length) {
        await sql`update games set home_spread = ${spread}, home_team = ${ev.home_team}, away_team = ${ev.away_team}, commence_time = ${ev.commence_time} where id = ${existing[0]!.id}`;
        continue;
      }
      await sql`insert into games (week_id, game_number, home_team, away_team, home_spread, commence_time, odds_event_id) values (${week.id}, ${n}, ${ev.home_team}, ${ev.away_team}, ${spread}, ${ev.commence_time}, ${ev.id})`;
      n += 1;
      added += 1;
    }
    return { ok: true as const, added, seen: events.length };
  });

export const getPoolBackup = createServerFn({ method: "GET" }).handler(async (): Promise<PoolBackup> => {
  const sql = await getSql();
  await ensureSeeded(sql);
  const [settings] = await sql<{ current_season_id: number | null; season: number; name: string }>`
    select current_season_id, season, name from pool_settings where id = 1
  `;
  const seasonRows = await sql<{ id: number; year: number; week_count: number; current_week: number }>`
    select id, year, week_count, current_week from seasons order by year
  `;
  const playerRows = await sql<PlayerRow & { season_id: number }>`select id, slot, name, season_id from players order by season_id, slot`;
  const weekRows = await sql<WeekRow & { season_id: number }>`select id, week_number, status, label, season_id from weeks order by season_id, week_number`;
  const gameRows = await sql<GameRow & { week_number: number; season_id: number }>`
    select g.*, w.week_number, w.season_id from games g join weeks w on w.id = g.week_id
  `;
  const pickRows = await sql<PickRow & { week_number: number; season_id: number; slot: number; game_number: number }>`
    select p.*, w.week_number, w.season_id, pl.slot, g.game_number
    from picks p
    join weeks w on w.id = p.week_id
    join players pl on pl.id = p.player_id
    join games g on g.id = p.game_id
  `;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeYear: settings?.season ?? seasonRows[0]?.year ?? 2026,
    settingsName: settings?.name ?? "Pick 'em Lines",
    seasons: seasonRows.map((s) => ({
      year: s.year,
      weekCount: s.week_count,
      currentWeek: s.current_week,
      players: playerRows.filter((p) => p.season_id === s.id).map((p) => ({ slot: p.slot, name: p.name })),
      weeks: weekRows.filter((w) => w.season_id === s.id).map((w) => ({ weekNumber: w.week_number, status: w.status, label: w.label })),
      games: gameRows.filter((g) => g.season_id === s.id).map((g) => ({
        weekNumber: g.week_number,
        gameNumber: g.game_number,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        homeSpread: Number(g.home_spread),
        commenceTime: g.commence_time ? String(g.commence_time) : null,
        atsResult: g.ats_result,
      })),
      picks: pickRows.filter((p) => p.season_id === s.id).map((p) => ({
        playerSlot: p.slot,
        weekNumber: p.week_number,
        gameNumber: p.game_number,
        selection: p.selection,
      })),
    })),
  };
});

export const importBackup = createServerFn({ method: "POST" })
  .validator((d: PoolBackup) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureSeeded(sql);
    for (const season of data.seasons) {
      let [row] = await sql<{ id: number }>`select id from seasons where year = ${season.year}`;
      if (!row) {
        const ins = await sql<{ id: number }>`insert into seasons (year, week_count, current_week) values (${season.year}, ${season.weekCount}, ${season.currentWeek}) returning id`;
        row = ins[0]!;
      } else {
        await sql`update seasons set week_count = ${season.weekCount}, current_week = ${season.currentWeek} where id = ${row.id}`;
      }
      await fillSeason(sql, row.id, season.weekCount);
      for (const p of season.players) {
        await sql`update players set name = ${p.name} where season_id = ${row.id} and slot = ${p.slot}`;
      }
      const weeks = await sql<{ id: number; week_number: number }>`select id, week_number from weeks where season_id = ${row.id}`;
      const weekId = new Map(weeks.map((w) => [w.week_number, w.id]));
      await sql`delete from picks where week_id in (select id from weeks where season_id = ${row.id})`;
      await sql`delete from games where week_id in (select id from weeks where season_id = ${row.id})`;
      for (const w of season.weeks) {
        const id = weekId.get(w.weekNumber);
        if (id) await sql`update weeks set status = ${w.status}, label = ${w.label} where id = ${id}`;
      }
      const gameIdByKey = new Map<string, number>();
      for (const g of season.games) {
        const wid = weekId.get(g.weekNumber);
        if (!wid) continue;
        const ins = await sql<{ id: number }>`
          insert into games (week_id, game_number, home_team, away_team, home_spread, commence_time, ats_result)
          values (${wid}, ${g.gameNumber}, ${g.homeTeam}, ${g.awayTeam}, ${g.homeSpread}, ${g.commenceTime}, ${g.atsResult})
          returning id
        `;
        gameIdByKey.set(`${g.weekNumber}:${g.gameNumber}`, ins[0]!.id);
      }
      const players = await sql<{ id: number; slot: number }>`select id, slot from players where season_id = ${row.id}`;
      const playerBySlot = new Map(players.map((p) => [p.slot, p.id]));
      for (const p of season.picks) {
        const pid = playerBySlot.get(p.playerSlot);
        const wid = weekId.get(p.weekNumber);
        const gid = gameIdByKey.get(`${p.weekNumber}:${p.gameNumber}`);
        if (!pid || !wid || !gid) continue;
        await sql`insert into picks (player_id, week_id, game_id, selection) values (${pid}, ${wid}, ${gid}, ${p.selection})`;
      }
    }
    const active = data.seasons.find((s) => s.year === data.activeYear) ?? data.seasons[0];
    if (active) {
      const [row] = await sql<{ id: number }>`select id from seasons where year = ${active.year}`;
      if (row) {
        await sql`update pool_settings set current_season_id = ${row.id}, season = ${active.year}, name = ${data.settingsName}, updated_at = now() where id = 1`;
      }
    }
    return { ok: true as const };
  });
