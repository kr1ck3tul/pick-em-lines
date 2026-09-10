import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMatch } from "@tanstack/react-router";
import type { PoolSnapshot } from "./types";
import {
  createSeason,
  deleteGame,
  fetchOddsIntoWeek,
  getPool,
  importBackup,
  importSlateGames,
  renamePlayer,
  resetPlayerPicks,
  resetSeason,
  resetWeekGames,
  saveOddsKey,
  savePicks,
  setAtsResult,
  setHomeSpread,
  setWeekCount,
  setWeekStatus,
  switchSeason,
  upsertGame,
} from "./server";

const KEY = ["pool"] as const;

export function usePool() {
  const initial = useMatch({
    from: "__root__",
    select: (m) => m.loaderData as PoolSnapshot | undefined,
    shouldThrow: false,
  });
  return useQuery({
    queryKey: KEY,
    queryFn: () => getPool(),
    initialData: initial,
  });
}

export function usePoolMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  function wrap<T, R>(fn: (opts: { data: T }) => Promise<R>) {
    return useMutation({
      mutationFn: (data: T) => fn({ data }),
      onSuccess: invalidate,
    });
  }
  return {
    renamePlayer: wrap(renamePlayer),
    setWeekStatus: wrap(setWeekStatus),
    setWeekCount: wrap(setWeekCount),
    switchSeason: wrap(switchSeason),
    createSeason: wrap(createSeason),
    saveOddsKey: wrap(saveOddsKey),
    upsertGame: wrap(upsertGame),
    setHomeSpread: wrap(setHomeSpread),
    setAtsResult: wrap(setAtsResult),
    deleteGame: wrap(deleteGame),
    savePicks: wrap(savePicks),
    resetPlayerPicks: wrap(resetPlayerPicks),
    resetSeason: wrap(resetSeason),
    resetWeekGames: wrap(resetWeekGames),
    importSlateGames: wrap(importSlateGames),
    fetchOddsIntoWeek: wrap(fetchOddsIntoWeek),
    importBackup: wrap(importBackup),
  };
}
