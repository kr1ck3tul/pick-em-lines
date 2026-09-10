export const DEFAULT_BOOKMAKER = "williamhill_us";

export const BOOKMAKERS = [
  { key: "williamhill_us", label: "Caesars" },
  { key: "draftkings", label: "DraftKings" },
  { key: "fanduel", label: "FanDuel" },
  { key: "betmgm", label: "BetMGM" },
  { key: "bovada", label: "Bovada" },
  { key: "all", label: "Any / first available" },
] as const;

export type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    markets: {
      key: string;
      outcomes: { name: string; point?: number }[];
    }[];
  }[];
};

export function homeSpreadFromEvent(ev: OddsEvent, bookmaker: string): number | null {
  const books =
    bookmaker === "all"
      ? ev.bookmakers
      : ev.bookmakers.filter((b) => b.key === bookmaker);
  for (const book of books.length ? books : ev.bookmakers) {
    const market = book.markets.find((m) => m.key === "spreads");
    const home = market?.outcomes.find((o) => o.name === ev.home_team);
    if (home && typeof home.point === "number") return home.point;
  }
  return null;
}

export async function fetchNcaafOdds(opts: {
  apiKey: string;
  bookmaker: string;
  commenceFrom?: string | null;
  commenceTo?: string | null;
}): Promise<OddsEvent[]> {
  const url = new URL("https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds");
  url.searchParams.set("apiKey", opts.apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");
  if (opts.bookmaker && opts.bookmaker !== "all") url.searchParams.set("bookmakers", opts.bookmaker);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Odds API ${res.status}`);
  }
  const events = (await res.json()) as OddsEvent[];
  return events.filter((ev) => {
    const d = ev.commence_time?.slice(0, 10);
    if (opts.commenceFrom && d && d < opts.commenceFrom) return false;
    if (opts.commenceTo && d && d > opts.commenceTo) return false;
    return true;
  });
}
