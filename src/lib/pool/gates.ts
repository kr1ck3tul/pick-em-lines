import type { WeekStatus } from "./types";

export const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  upcoming: "Upcoming",
  open: "Open for picks",
  locked: "Locked",
  final: "Final",
};

export function canEnterPicks(status: WeekStatus): boolean {
  return status === "upcoming" || status === "open";
}

export function canEditSlate(status: WeekStatus): boolean {
  return status === "upcoming";
}

export function canFetchOdds(status: WeekStatus): boolean {
  return status === "upcoming";
}

export function canGradeGames(status: WeekStatus): boolean {
  return status === "locked" || status === "final";
}
