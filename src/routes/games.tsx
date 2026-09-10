import { createFileRoute } from "@tanstack/react-router";
import { PoolGate } from "@/components/pool-gate";
import { GamesDesk } from "@/components/games-desk";

type GamesSearch = { week?: number };

export const Route = createFileRoute("/games")({
  validateSearch: (search: Record<string, unknown>): GamesSearch => ({
    week: search.week == null || search.week === "" ? undefined : Number(search.week),
  }),
  component: GamesPage,
});

function GamesPage() {
  const { week } = Route.useSearch();
  return (
    <PoolGate>
      {(pool) => <GamesDesk pool={pool} weekNumber={Number.isFinite(week) ? Number(week) : pool.settings.currentWeek} />}
    </PoolGate>
  );
}
