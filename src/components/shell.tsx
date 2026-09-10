import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Flag, LayoutList, Menu, Settings, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePool } from "@/lib/pool/queries";

function NavLinks({
  onClick,
  weekNumber,
  pathname,
}: {
  onClick?: () => void;
  weekNumber: number;
  pathname: string;
}) {
  const week = String(weekNumber);
  const items: { label: string; node: ReactNode }[] = [
    {
      label: "Standings",
      node: (
        <Link to="/" onClick={onClick} className={linkClass(pathname === "/")}>
          <Trophy className="size-4" />
          Standings
        </Link>
      ),
    },
    {
      label: "This week",
      node: (
        <Link
          to="/week/$weekNumber"
          params={{ weekNumber: week }}
          onClick={onClick}
          className={linkClass(pathname.startsWith("/week"))}
        >
          <Flag className="size-4" />
          This week
        </Link>
      ),
    },
    {
      label: "Picks",
      node: (
        <Link to="/picks" search={{ week: weekNumber }} onClick={onClick} className={linkClass(pathname.startsWith("/picks"))}>
          <ClipboardList className="size-4" />
          Picks
        </Link>
      ),
    },
    {
      label: "Games",
      node: (
        <Link to="/games" search={{ week: weekNumber }} onClick={onClick} className={linkClass(pathname.startsWith("/games"))}>
          <LayoutList className="size-4" />
          Games
        </Link>
      ),
    },
    {
      label: "Admin",
      node: (
        <Link to="/desk" onClick={onClick} className={linkClass(pathname.startsWith("/desk"))}>
          <Settings className="size-4" />
          Admin
        </Link>
      ),
    },
  ];
  return (
    <>
      {items.map((item) => (
        <span key={item.label}>{item.node}</span>
      ))}
    </>
  );
}

function linkClass(active: boolean) {
  return cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pool = usePool();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const weekNumber = pool.data?.settings.currentWeek ?? 1;
  const name = pool.data?.settings.name ?? "Pick 'em Lines";

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">{name}</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
            <NavLinks weekNumber={weekNumber} pathname={pathname} />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="pt-12">
                <p className="mb-4 font-display text-2xl">{name}</p>
                <nav className="flex flex-col gap-1">
                  <NavLinks weekNumber={weekNumber} pathname={pathname} />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
