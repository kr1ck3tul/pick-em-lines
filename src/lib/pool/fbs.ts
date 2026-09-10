import { schoolName } from "@/lib/utils";

const FBS_TEAMS = [
  "Air Force","Akron","Alabama","Appalachian State","Arizona","Arizona State","Arkansas","Arkansas State",
  "Army","Auburn","Ball State","Baylor","Boise State","Boston College","Bowling Green","Buffalo","BYU",
  "California","Central Michigan","Charlotte","Cincinnati","Clemson","Coastal Carolina","Colorado",
  "Colorado State","Duke","East Carolina","Eastern Michigan","Florida","Florida Atlantic","Florida International",
  "Florida State","Fresno State","Georgia","Georgia Southern","Georgia State","Georgia Tech","Hawaii","Houston",
  "Illinois","Indiana","Iowa","Iowa State","Jacksonville State","James Madison","Kansas","Kansas State",
  "Kennesaw State","Kent State","Kentucky","Liberty","Louisiana","Louisiana Tech","Louisville","LSU","Marshall",
  "Maryland","Memphis","Miami","Miami (OH)","Michigan","Michigan State","Middle Tennessee","Minnesota",
  "Mississippi State","Missouri","Navy","NC State","Nebraska","Nevada","New Mexico","New Mexico State",
  "North Carolina","North Texas","Northern Illinois","Northwestern","Notre Dame","Ohio","Ohio State","Oklahoma",
  "Oklahoma State","Old Dominion","Ole Miss","Oregon","Oregon State","Penn State","Pittsburgh","Purdue","Rice",
  "Rutgers","Sam Houston","San Diego State","San Jose State","SMU","South Alabama","South Carolina","South Florida",
  "Southern Miss","Stanford","Syracuse","TCU","Temple","Tennessee","Texas","Texas A&M","Texas State","Texas Tech",
  "Toledo","Troy","Tulane","Tulsa","UAB","UCF","UCLA","UConn","UL Monroe","UMass","UNLV","USC","Utah","Utah State",
  "UTEP","UTSA","Vanderbilt","Virginia","Virginia Tech","Wake Forest","Washington","Washington State",
  "West Virginia","Western Kentucky","Western Michigan","Wisconsin","Wyoming",
];

const ALIAS: Record<string, string> = {
  mississippi: "ole miss",
  "miami ohio": "miami (oh)",
  "miami oh": "miami (oh)",
  "miami fl": "miami",
  "n.c. state": "nc state",
  "north carolina state": "nc state",
  "app state": "appalachian state",
  "appalachian st": "appalachian state",
  jmu: "james madison",
  "texas am": "texas a&m",
  "louisiana monroe": "ul monroe",
  ulm: "ul monroe",
  connecticut: "uconn",
  massachusetts: "umass",
  "hawai i": "hawaii",
  "sam houston state": "sam houston",
  "southern mississippi": "southern miss",
  pitt: "pittsburgh",
  "penn st": "penn state",
  "ohio st": "ohio state",
  usf: "south florida",
  "south fla": "south florida",
  "va tech": "virginia tech",
  "army west point": "army",
};

function norm(s: string): string {
  return schoolName(s)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9() ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CANON = new Set(FBS_TEAMS.map(norm));

function canon(raw: string): string {
  const n = norm(raw);
  return ALIAS[n] ?? n;
}

export function isFbsTeam(name: string): boolean {
  const c = canon(name);
  if (CANON.has(c)) return true;
  for (const t of CANON) {
    if (c === t || c.startsWith(`${t} `) || t.startsWith(`${c} `)) return true;
  }
  return false;
}

export function isFbsMatchup(away: string, home: string): boolean {
  return isFbsTeam(away) && isFbsTeam(home);
}
