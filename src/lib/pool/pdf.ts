import { formatRecord, outcomeFor } from "./scoring";
import { formatSpread, schoolName } from "@/lib/utils";
import type { Game, Player, PoolSnapshot, Selection } from "./types";

const MARGIN = 36;
const HEADER_Y = 72;
const INK: [number, number, number] = [20, 22, 21];
const MUTED: [number, number, number] = [110, 116, 112];
const RULE: [number, number, number] = [200, 204, 198];
const HEAD: [number, number, number] = [32, 40, 36];
const STRIPE: [number, number, number] = [248, 248, 246];
const WIN: [number, number, number] = [26, 120, 62];
const LOSS: [number, number, number] = [160, 50, 42];

type JsPDF = import("jspdf").jsPDF;
type AutoTable = (doc: JsPDF, opts: Record<string, unknown>) => void;

async function loadPdf() {
  const { jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod.default ?? autoTableMod.autoTable) as AutoTable;
  return { jsPDF, autoTable };
}

function ascii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, " ");
}

function rec(wins: number, losses: number): string {
  return formatRecord(wins, losses);
}

function kickFull(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);
}

function fileName(parts: string[]): string {
  return `${parts.join("-").replace(/[^\w.-]+/g, "-").toLowerCase()}.pdf`;
}

function sideName(game: Game, sel: Selection) {
  return schoolName(sel === "home" ? game.homeTeam : game.awayTeam);
}
function sideSpread(game: Game, sel: Selection) {
  return formatSpread(sel === "home" ? game.homeSpread : -game.homeSpread);
}

function weekGames(pool: PoolSnapshot, weekNumber: number) {
  const week = pool.weeks.find((w) => w.weekNumber === weekNumber);
  const games = pool.games.filter((g) => g.weekId === week?.id).sort((a, b) => a.gameNumber - b.gameNumber);
  return { week, weekLabel: week?.label ?? `Week ${weekNumber}`, games };
}

function playerRecords(pool: PoolSnapshot, playerId: number, weekNumber: number) {
  const season = pool.season.find((r) => r.playerId === playerId);
  const weekly = season?.weekly.find((w) => w.weekNumber === weekNumber);
  return { season: rec(season?.wins ?? 0, season?.losses ?? 0), week: rec(weekly?.wins ?? 0, weekly?.losses ?? 0) };
}

function addHeader(doc: JsPDF, opts: { title: string; subtitle?: string; right?: string }) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(ascii(opts.title), MARGIN, 36);
  if (opts.right) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(ascii(opts.right), w - MARGIN, 36, { align: "right" });
  }
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(ascii(opts.subtitle), MARGIN, 52);
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 60, w - MARGIN, 60);
}

function addFooters(doc: JsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE);
    doc.line(MARGIN, h - 32, w - MARGIN, h - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${i} / ${pages}`, w - MARGIN, h - 18, { align: "right" });
  }
}

function drawCheckboxes(data: { section: string; column: { dataKey?: string }; cell: { x: number; y: number; width: number; height: number }; doc: JsPDF }) {
  if (data.section !== "body") return;
  if (data.column.dataKey !== "h" && data.column.dataKey !== "a") return;
  const s = 8;
  const cx = data.cell.x + (data.cell.width - s) / 2;
  const cy = data.cell.y + (data.cell.height - s) / 2;
  data.doc.setDrawColor(...INK);
  data.doc.setLineWidth(0.7);
  data.doc.rect(cx, cy, s, s);
}

function addGameTable(
  doc: JsPDF,
  autoTable: AutoTable,
  pool: PoolSnapshot,
  weekNumber: number,
  header: { title: string; right?: string },
  pickBoxes: boolean,
) {
  const { games } = weekGames(pool, weekNumber);
  const usable = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const nW = 22;
  const spreadW = 38;
  const boxW = 26;
  const boxes = pickBoxes ? boxW * 2 : 0;
  const kickW = pickBoxes ? 140 : 192;
  const teamW = (usable - nW - spreadW * 2 - kickW - boxes) / 2;
  autoTable(doc, {
    theme: "grid",
    startY: HEADER_Y,
    tableWidth: usable,
    margin: { top: HEADER_Y, left: MARGIN, right: MARGIN, bottom: 36 },
    styles: { font: "helvetica", fontSize: 8, textColor: INK, lineColor: RULE, lineWidth: 0.4, valign: "middle" },
    headStyles: { fillColor: HEAD, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: STRIPE },
    willDrawPage: () => addHeader(doc, header),
    columns: [
      { header: "#", dataKey: "n" },
      { header: "Away", dataKey: "away" },
      { header: "Spread", dataKey: "awaySpread" },
      { header: "Home", dataKey: "home" },
      { header: "Spread", dataKey: "homeSpread" },
      { header: "Kick", dataKey: "kick" },
      ...(pickBoxes ? [{ header: "H", dataKey: "h" }, { header: "A", dataKey: "a" }] : []),
    ],
    body: games.length
      ? games.map((g) => ({
          n: String(g.gameNumber),
          away: ascii(schoolName(g.awayTeam)),
          awaySpread: formatSpread(-g.homeSpread),
          home: ascii(schoolName(g.homeTeam)),
          homeSpread: formatSpread(g.homeSpread),
          kick: kickFull(g.commenceTime),
          h: "",
          a: "",
        }))
      : [{ n: "", away: "No games posted.", awaySpread: "", home: "", homeSpread: "", kick: "", h: "", a: "" }],
    columnStyles: {
      n: { cellWidth: nW, halign: "right", font: "courier" },
      away: { cellWidth: teamW },
      awaySpread: { cellWidth: spreadW, font: "courier", halign: "left" },
      home: { cellWidth: teamW },
      homeSpread: { cellWidth: spreadW, font: "courier", halign: "left" },
      kick: { cellWidth: kickW, overflow: "ellipsize" },
      h: { cellWidth: boxW, halign: "center" },
      a: { cellWidth: boxW, halign: "center" },
    },
    didDrawCell: pickBoxes ? drawCheckboxes : undefined,
  });
}

function drawPickCard(
  doc: JsPDF,
  opts: { x: number; y: number; w: number; h: number; title: string; meta: string; picks: { gameId: number; selection: Selection }[]; gameById: Map<number, Game> },
) {
  const { x, y, w, h, title, meta, picks, gameById } = opts;
  doc.setDrawColor(...RULE);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 5, 5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(ascii(title).slice(0, 28), x + 5, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text(ascii(meta), x + 5, y + 22);
  const lineH = (h - 30) / 10;
  if (picks.length === 0) {
    for (let n = 0; n < 10; n++) {
      const ly = y + 34 + n * lineH;
      doc.setFont("courier", "normal");
      doc.setFontSize(6);
      doc.text(`${n + 1}.`, x + 5, ly);
      doc.line(x + 17, ly + 1, x + w - 6, ly + 1);
    }
    return;
  }
  picks.forEach((p, n) => {
    const g = gameById.get(p.gameId);
    if (!g) return;
    const ly = y + 34 + n * lineH;
    const o = outcomeFor(p.selection, g.atsResult);
    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text(`#${g.gameNumber}`, x + 5, ly);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(ascii(sideName(g, p.selection)).slice(0, 16), x + 24, ly);
    if (o === "W") doc.setTextColor(...WIN);
    else if (o === "L") doc.setTextColor(...LOSS);
    else doc.setTextColor(...MUTED);
    doc.setFont("courier", "normal");
    doc.text(`${sideSpread(g, p.selection)}${o ? ` ${o}` : ""}`, x + w - 5, ly, { align: "right" });
  });
}

function layoutCards(doc: JsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cols = 5;
  const rows = 3;
  const gap = 6;
  const colW = (pageW - MARGIN * 2 - gap * (cols - 1)) / cols;
  const cardH = (pageH - HEADER_Y - 36 - gap * (rows - 1)) / rows;
  return { cols, gap, colW, cardH, startY: HEADER_Y };
}

export async function downloadStandingsPdf(pool: PoolSnapshot): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const weeks = pool.weeks;
  autoTable(doc, {
    theme: "grid",
    startY: HEADER_Y,
    margin: { top: HEADER_Y, left: MARGIN, right: MARGIN, bottom: 36 },
    styles: { font: "helvetica", fontSize: 8, halign: "center", valign: "middle" },
    headStyles: { fillColor: HEAD, textColor: 255, fontStyle: "bold" },
    willDrawPage: () => addHeader(doc, { title: "Season standings", right: String(pool.settings.season) }),
    head: [["Rk", "Player", "W-L", "Pct", ...weeks.map((w) => `W${w.weekNumber}`)]],
    body: pool.season.map((row) => {
      const name = pool.players.find((p) => p.id === row.playerId)?.name ?? "—";
      return [
        String(row.rank),
        name,
        rec(row.wins, row.losses),
        row.pct < 0 ? "—" : `${Math.round(row.pct * 1000) / 10}%`,
        ...weeks.map((w) => {
          const wk = row.weekly.find((x) => x.weekNumber === w.weekNumber);
          return rec(wk?.wins ?? 0, wk?.losses ?? 0);
        }),
      ];
    }),
  });
  addFooters(doc);
  doc.save(fileName(["standings", String(pool.settings.season)]));
}

export async function downloadWeekSlatePdf(pool: PoolSnapshot, weekNumber: number): Promise<void> {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const { weekLabel } = weekGames(pool, weekNumber);
  addGameTable(doc, autoTable, pool, weekNumber, { title: weekLabel, right: String(pool.settings.season) }, true);
  addFooters(doc);
  doc.save(fileName([weekLabel, "slate"]));
}

export async function downloadPlayerCardsPdf(pool: PoolSnapshot, weekNumber: number, playerId: number | "all" = "all"): Promise<void> {
  const { jsPDF } = await loadPdf();
  const player = playerId === "all" ? null : pool.players.find((p) => p.id === playerId) ?? null;
  const recs = player ? playerRecords(pool, player.id, weekNumber) : null;
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const { weekLabel, week, games } = weekGames(pool, weekNumber);
  const { cols, gap, colW, cardH, startY } = layoutCards(doc);
  if (player && recs) {
    addHeader(doc, { title: ascii(player.name), right: String(pool.settings.season), subtitle: `Season ${recs.season}` });
    const gameById = new Map(pool.games.map((g) => [g.id, g]));
    pool.weeks.forEach((w, i) => {
      const weekly = pool.season.find((r) => r.playerId === player.id)?.weekly.find((x) => x.weekNumber === w.weekNumber);
      const picks = pool.picks.filter((p) => p.playerId === player.id && p.weekId === w.id);
      const slot = i % 15;
      drawPickCard(doc, {
        x: MARGIN + (slot % cols) * (colW + gap),
        y: startY + Math.floor(slot / cols) * (cardH + gap),
        w: colW,
        h: cardH,
        title: w.label,
        meta: rec(weekly?.wins ?? 0, weekly?.losses ?? 0),
        picks,
        gameById,
      });
    });
    addFooters(doc);
    doc.save(fileName([player.name, "season"]));
    return;
  }
  addHeader(doc, { title: weekLabel, right: String(pool.settings.season), subtitle: "Player cards" });
  const gameById = new Map(games.map((g) => [g.id, g]));
  pool.players.forEach((pl, i) => {
    const r = playerRecords(pool, pl.id, weekNumber);
    const picks = pool.picks.filter((p) => p.playerId === pl.id && p.weekId === week?.id);
    drawPickCard(doc, {
      x: MARGIN + (i % cols) * (colW + gap),
      y: startY + Math.floor(i / cols) * (cardH + gap),
      w: colW,
      h: cardH,
      title: pl.name,
      meta: `Week ${r.week}  ·  Season ${r.season}`,
      picks,
      gameById,
    });
  });
  addFooters(doc);
  doc.save(fileName([weekLabel, "cards"]));
}

export type { Player };
