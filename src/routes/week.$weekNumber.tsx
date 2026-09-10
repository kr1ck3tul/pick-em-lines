import { createFileRoute } from "@tanstack/react-router";
import { PoolGate } from "@/components/pool-gate";
import { WeekBoard } from "@/components/week-board";

export const Route = createFileRoute("/week/$weekNumber")({ component: WeekPage });

function WeekPage() {
  const { weekNumber } = Route.useParams();
  const n = Number(weekNumber);
  return <PoolGate>{(pool) => <WeekBoard pool={pool} weekNumber={Number.isFinite(n) ? n : pool.settings.currentWeek} />}</PoolGate>;
}
