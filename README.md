# Pick ’em Lines

College football pick’em for a 15-player pool: standings, weekly slates, 10 picks a week, player cards, and Excel backup.

**To run this on your own host (Vercel, Railway, etc.), read [HOSTING.md](HOSTING.md).** You need Node 22, a Postgres database, and `VITE_AUTH_ENABLED=false`.

## What it does

- **Standings** — season W–L plus a column per week
- **This week** — slate, player cards, print PDF
- **Picks** — 15 player buttons, auto-save, 10 games
- **Games** — fetch NCAAF spreads, upload RotoWire Excel, grade Home/Away/Tie
- **Admin** — season year, week count, week status, roster names, Odds API key, Excel import/export, passworded reset (year)

Seeded for **2026**, 13 weeks, roster: Brandon, Chad B, Chad S, Mike, Mitch, Nix, Patrick, Philip, Ron, Sam, Scott, Tom R, Tom T, Trent, Wayne B.
