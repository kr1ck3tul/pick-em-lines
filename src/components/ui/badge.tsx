import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "open" | "tie" | "lead";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]",
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "open" && "bg-win/30 text-win-foreground",
        variant === "tie" && "bg-tie/40 text-foreground",
        variant === "lead" && "bg-win/25 text-win-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
