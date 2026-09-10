import type { ReactNode } from "react";
import type { PoolSnapshot } from "@/lib/pool/types";
import { usePool } from "@/lib/pool/queries";

export function PoolGate({ children }: { children: (pool: PoolSnapshot) => ReactNode }) {
  const pool = usePool();
  if (pool.isPending) return <p className="text-sm text-muted-foreground">Loading pool…</p>;
  if (pool.isError) {
    return (
      <p className="text-sm text-destructive">
        {pool.error instanceof Error ? pool.error.message : "Could not load the pool."}
      </p>
    );
  }
  if (!pool.data) return null;
  return <>{children(pool.data)}</>;
}
