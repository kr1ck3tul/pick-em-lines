export type BackupPlayer = { slot: number; name: string };
export type BackupWeek = { weekNumber: number; status: string; label: string };
export type BackupGame = {
  weekNumber: number;
  gameNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeSpread: number;
  commenceTime: string | null;
  atsResult: string | null;
};
export type BackupPick = {
  playerSlot: number;
  weekNumber: number;
  gameNumber: number;
  selection: string;
};
export type BackupSeason = {
  year: number;
  weekCount: number;
  currentWeek: number;
  players: BackupPlayer[];
  weeks: BackupWeek[];
  games: BackupGame[];
  picks: BackupPick[];
};

export type PoolBackup = {
  version: 1;
  exportedAt: string;
  activeYear: number;
  settingsName: string;
  seasons: BackupSeason[];
};
