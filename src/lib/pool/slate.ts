export type SlateGame = {
  awayTeam: string;
  homeTeam: string;
  homeSpread: number;
  commenceTime: string | null;
};

function cell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseSpread(raw: string): number | null {
  const s = raw.replace(/pk|pick'em|pick em/i, "0").replace(/[−–]/g, "-");
  const n = Number(s.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function excelDateToIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  const s = cell(v);
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      const utc = Date.UTC(1899, 11, 30) + n * 86400000;
      return new Date(utc).toISOString();
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function headerIndex(row: unknown[], names: string[]): number {
  const lower = row.map((c) => cell(c).toLowerCase());
  for (const name of names) {
    const i = lower.findIndex((c) => c === name || c.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

export async function parseSlateFile(file: File): Promise<SlateGame[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("No spreadsheet tab found.");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  if (rows.length < 2) throw new Error("That file looks empty.");

  let headerRow = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const joined = rows[i].map(cell).join(" ").toLowerCase();
    if (joined.includes("team") || joined.includes("away") || joined.includes("spread")) {
      headerRow = i;
      break;
    }
  }
  const header = rows[headerRow] ?? [];
  const teamCol = headerIndex(header, ["team", "club"]);
  const awayCol = headerIndex(header, ["away", "visitor", "road"]);
  const homeCol = headerIndex(header, ["home"]);
  const spreadCol = headerIndex(header, ["spread", "line", "ou"]);
  const dateCol = headerIndex(header, ["date", "kick", "time"]);

  const games: SlateGame[] = [];

  if (awayCol >= 0 && homeCol >= 0) {
    for (const row of rows.slice(headerRow + 1)) {
      const away = cell(row[awayCol]);
      const home = cell(row[homeCol]);
      if (!away || !home) continue;
      const sp = parseSpread(cell(row[spreadCol])) ?? 0;
      games.push({
        awayTeam: away,
        homeTeam: home,
        homeSpread: sp,
        commenceTime: dateCol >= 0 ? excelDateToIso(row[dateCol]) : null,
      });
    }
  } else if (teamCol >= 0) {
    const body = rows.slice(headerRow + 1).filter((r) => cell(r[teamCol]));
    for (let i = 0; i + 1 < body.length; i += 2) {
      const a = body[i];
      const h = body[i + 1];
      const away = cell(a[teamCol]);
      const home = cell(h[teamCol]);
      if (!away || !home) continue;
      const awaySp = parseSpread(cell(a[spreadCol]));
      const homeSp = parseSpread(cell(h[spreadCol]));
      const homeSpread = homeSp ?? (awaySp != null ? -awaySp : 0);
      games.push({
        awayTeam: away,
        homeTeam: home,
        homeSpread,
        commenceTime: dateCol >= 0 ? excelDateToIso(h[dateCol] || a[dateCol]) : null,
      });
    }
  } else {
    throw new Error(
      "No games found. Use a RotoWire odds sheet (Team / Date / Spread, two rows per game) or Away / Home / Spread columns.",
    );
  }

  if (games.length === 0) throw new Error("No games found in that file.");
  return games;
}
