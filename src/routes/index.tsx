import { createFileRoute } from "@tanstack/react-router";
import { PoolGate } from "@/components/pool-gate";
import { Standings } from "@/components/standings";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <PoolGate>{(pool) => <Standings pool={pool} />}</PoolGate>;
}
