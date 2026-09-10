# Host Pick ’em Lines on your own site

This is a full-stack web app (React + server functions + Postgres). It is **not** a static site. GitHub Pages / Netlify static hosting will not work.

You need:

- **Node.js 22**
- A **Postgres** database (Neon is the easiest)
- A host that can run a Node / Vercel serverless app (Vercel, Railway, Fly, Render, a VPS)

Odds fetching uses [The Odds API](https://the-odds-api.com/). Paste the key in **Admin → Odds API** after the site is up. It is stored in the database, not in env vars.

---

## Environment variables

Set these in the host’s dashboard. Do not commit a `.env` file.

| Name | Required | Value |
|---|---|---|
| `DATABASE_URL` | **Yes** for a durable pool | Postgres connection string (Neon pooled URL is fine) |
| `VITE_AUTH_ENABLED` | **Yes** | `false` — this app has no sign-in |
| `NITRO_PRESET` | Only off Vercel | `node-server` for Railway / Fly / Render / a VPS |
| `PORT` | Node hosts only | Your host usually sets this |

If `DATABASE_URL` is missing, the app falls back to an in-memory database that **resets on every deploy/restart**. Always set Postgres in production. The production build will not stay up without it.

---

## 1. Vercel (recommended)

The production build already targets Vercel.

1. Push this folder to a GitHub repo (without `node_modules`).
2. Import the repo in [Vercel](https://vercel.com).
3. Create a [Neon](https://neon.tech) project → copy the connection string.
4. In the Vercel project, set:
   - `DATABASE_URL` = Neon URL
   - `VITE_AUTH_ENABLED` = `false`
5. Framework: leave as detected, or **Other**. Output directory: **leave blank**. Nitro writes `.vercel/output` itself.
6. Build command: `npm run build` (already in `package.json`).
7. Node.js version: **22**.
8. Deploy.

First load seeds the **2026** season, 13 weeks, and the 15-player roster. Then:

- **Admin** → paste your Odds API key
- **Games** → Fetch odds or Upload Excel
- **Admin** → set week status to Open for picks
- Use **Backup** on Standings / This week / Picks / Games (or Admin → Export Excel) so you always have a copy

---

## 2. Railway / Fly / Render / a VPS

These run a long-lived Node server instead of Vercel serverless.

```bash
npm install
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs
```

Set the same env vars (`DATABASE_URL`, `VITE_AUTH_ENABLED=false`). The process listens on `PORT` (Nitro default 3000).

**Railway start command:** `node .output/server/index.mjs`  
**Railway build command:** `NITRO_PRESET=node-server npm run build`

`npm run build` applies `migrations/*.sql` when `DATABASE_URL` is set. That is how the tables get created.

---

## 3. Local run (for you, not required)

```bash
npm install
# optional: export DATABASE_URL=postgres://...
export VITE_AUTH_ENABLED=false
npm run dev
```

Without `DATABASE_URL`, preview uses the embedded database (data is lost when the process stops).

---

## What to do after first deploy

1. Open **Admin**. Confirm season **2026**.
2. Save an Odds API key.
3. Open **Games**, pick the week, set From/To dates, leave **FBS vs FBS** checked, **Fetch odds**. Or **Upload Excel** (RotoWire-style sheet). From/To apply only to Fetch, not Excel.
4. Set that week to **Open for picks** so the group can fill cards.
5. **Lock** the week when kickoff hits; grade Home / Away / Tie after games.
6. Download an Excel **Backup** after you enter a slate or a round of picks.

Reset on Admin is passworded with the **season year** (e.g. `2026`).

---

## Excel backup / restore

- **Export** writes every season, roster, week status, game, and pick.
- **Import** (Admin) restores from that workbook. It replaces games/picks for years in the file.

Keep a copy somewhere besides the host (Drive, email, disk). This app does not send Thursday email backups — that needs a mail server you would have to add later.

---

## Odds API

Sport: `americanfootball_ncaaf`. Default book is Caesars (`williamhill_us`). DraftKings, FanDuel, BetMGM, Bovada are in the Games sportsbook menu. Fetch only works while the week is **Upcoming**, so locked/final slates are not overwritten.

---

## Notes

- There is **no login**. Anyone with the URL can edit the pool. Put it behind your own password / VPN / host access control if the URL will be public.
- Prints (slate, player cards, standings) download as PDF in the browser.
- The small “Created with Grok” badge is part of the original project chrome and does not affect the pool.
