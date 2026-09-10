import { createFileRoute } from "@tanstack/react-router";
import { PoolGate } from "@/components/pool-gate";
import { PickBuilder } from "@/components/pick-builder";

type PicksSearch = { week?: number; player?: number };

export const Route = createFileRoute("/picks")({
  validateSearch: (search: Record<string, unknown>): PicksSearch => ({
    week: search.week == null || search.week === "" ? undefined : Number(search.week),
    player: search.player == null || search.player === "" ? undefined : Number(search.player),
  }),
  component: PicksPage,
});

function PicksPage() {
  const { week, player } = Route.useSearch();
  return (
    <PoolGate>
      {(pool) => (
        <PickBuilder
          pool={pool}
          weekNumber={Number.isFinite(week) ? Number(week) : pool.settings.currentWeek}
          initialPlayerId={Number.isFinite(player) ? Number(player) : undefined}
        />
      )}
    </PoolGate>
  );
}
