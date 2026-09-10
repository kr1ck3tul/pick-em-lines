import { createFileRoute } from "@tanstack/react-router";
import { PoolGate } from "@/components/pool-gate";
import { DeskPanel } from "@/components/desk-panel";

export const Route = createFileRoute("/desk")({ component: DeskPage });

function DeskPage() {
  return <PoolGate>{(pool) => <DeskPanel pool={pool} />}</PoolGate>;
}
