export type WeekStatus = "upcoming" | "open" | "locked" | "final";
export type AtsResult = "home_cover" | "away_cover" | "push";
export type Selection = "home" | "away";

export type SeasonSummary = {
  id: number;
  year: number;
  weekCount: number;
  currentWeek: number;
};

export type PoolSettings = {
  name: string;
  season: number;
  seasonId: number;
  currentWeek: number;
  weekCount: number;
  hasOddsKey: boolean;
  oddsKeyLast4: string | null;
};

export type Player = {
  id: number;
  slot: number;
  name: string;
};

export type Week = {
  id: number;
  weekNumber: number;
  status: WeekStatus;
  label: string;
};

export type Game = {
  id: number;
  weekId: number;
  gameNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeSpread: number;
  commenceTime: string | null;
  oddsEventId: string | null;
  atsResult: AtsResult | null;
};

export type Pick = {
  playerId: number;
  weekId: number;
  gameId: number;
  selection: Selection;
};

export type RecordLine = {
  playerId: number;
  wins: number;
  losses: number;
  pending: number;
  pct: number;
};

export type SeasonRow = RecordLine & {
  rank: number;
  tied: boolean;
  weekly: { weekNumber: number; wins: number; losses: number; pending: number }[];
};

export type WeeklyBoard = {
  week: Week;
  games: Game[];
  records: (RecordLine & { highlight: "lead" | "tie" | null })[];
};

export type PoolSnapshot = {
  settings: PoolSettings;
  seasons: SeasonSummary[];
  players: Player[];
  rosters: { seasonId: number; year: number; players: Player[] }[];
  weeks: Week[];
  games: Game[];
  picks: Pick[];
  season: SeasonRow[];
  weeklyBoards: WeeklyBoard[];
};

export const PICKS_PER_WEEK = 10;
export const PLAYER_COUNT = 15;
export const MIN_WEEKS = 1;
export const MAX_WEEKS = 20;

export const DEFAULT_ROSTER = [
  "Brandon",
  "Chad B",
  "Chad S",
  "Mike",
  "Mitch",
  "Nix",
  "Patrick",
  "Philip",
  "Ron",
  "Sam",
  "Scott",
  "Tom R",
  "Tom T",
  "Trent",
  "Wayne B",
];
