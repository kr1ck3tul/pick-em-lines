import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function formatSpread(n: number): string {
  if (!Number.isFinite(n)) return "PK";
  if (n === 0) return "PK";
  const v = Math.round(n * 10) / 10;
  return v > 0 ? `+${v}` : String(v);
}

const MASCOTS = [
  "Fighting Irish",
  "Rainbow Warriors",
  "Nittany Lions",
  "Golden Bears",
  "Golden Eagles",
  "Golden Flashes",
  "Golden Hurricane",
  "Thundering Herd",
  "Mountain Hawks",
  "Mean Green",
  "Blue Devils",
  "Red Raiders",
  "Red Wolves",
  "Horned Frogs",
  "Demon Deacons",
  "Crimson Tide",
  "Scarlet Knights",
  "Seminoles",
  "Sooners",
  "Longhorns",
  "Wolverines",
  "Buckeyes",
  "Nittany",
  "Tar Heels",
  "Yellow Jackets",
  "Black Knights",
  "Midshipmen",
  "Aztecs",
  "Cougars",
  "Bulldogs",
  "Wildcats",
  "Tigers",
  "Huskies",
  "Spartans",
  "Trojans",
  "Bruins",
  "Ducks",
  "Beavers",
  "Gators",
  "Volunteers",
  "Commodores",
  "Rebels",
  "Aggies",
  "Mustangs",
  "Owls",
  "Bears",
  "Bison",
  "Rams",
  "Falcons",
  "Eagles",
  "Hawks",
  "Panthers",
  "Bobcats",
  "Cardinals",
  "Razorbacks",
  "Jayhawks",
  "Cyclones",
  "Cowboys",
  "Mountaineers",
  "Hokies",
  "Cavaliers",
  "Terrapins",
  "Hoosiers",
  "Boilermakers",
  "Illini",
  "Hawkeyes",
  "Badgers",
  "Cornhuskers",
  "Sun Devils",
  "Utes",
  "Buffaloes",
  "Lobos",
  "Miners",
  "Roadrunners",
  "Wolf Pack",
  "Wolfpack",
  "Rainbows",
  "Rainbow Warriors",
  "Warriors",
  "Titans",
  "Knights",
  "Pirates",
  "Gamecocks",
  "Paladins",
  "Chanticleers",
  "Bearcats",
  "Bearkats",
  "Blazers",
  "Green Wave",
  "Frog",
  "Horned Frog",
];

export function schoolName(raw: string): string {
  let s = raw.trim();
  const sorted = [...MASCOTS].sort((a, b) => b.length - a.length);
  for (const m of sorted) {
    const re = new RegExp(`\\s+${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    if (re.test(s)) {
      s = s.replace(re, "").trim();
      break;
    }
  }
  return s || raw.trim();
}
