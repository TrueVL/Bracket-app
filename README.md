# Bracket Club 🏆

Make playoff brackets for every major North American league, share them with your friends, and compete on a live leaderboard.

- **Leagues:** NFL, NBA, NHL (Stanley Cup), MLB, MLS, WNBA, the College Football Playoff, the NCAA men's and women's tournaments (64 teams), plus custom 4/8/16-team brackets for anything else.
- **Real formats:** NFL re-seeding after the Wild Card round, MLB and CFP byes, the MLS wild card game, NHL divisional brackets with wild cards, best-of-N series.
- **Pools:** create a pool, drop the playoff teams into their seeds, and share one invite link. Everyone fills out a bracket before the lock time. Picks stay hidden until then.
- **Competition:** the commissioner clicks winners as games finish, and the leaderboard updates with points, max possible points and ranks. You can configure points per round, an optional bonus for calling the exact series score, and a tiebreaker.
- **Sharing:** every bracket has its own link. Once picks lock, anyone with the link can view it.
- Works on phones: there's a round-by-round view for small screens, plus light and dark mode.

## Getting started

1. Install **Node.js 22.13 or newer**. Get the "LTS" version from https://nodejs.org.
2. Download this repo: use `git clone`, or on GitHub click **Code → Download ZIP** and unzip it.
3. Open a terminal **in the project folder**, the one that contains `package.json`. Windows: open the folder in File Explorer, click the address bar, type `cmd` and press Enter. Mac: right-click the folder and choose *New Terminal at Folder*.
4. Run:

   ```bash
   npm run dev
   ```

   **Windows shortcut:** skip the terminal and double-click `start-windows.cmd` in the project folder instead.

   The first run installs the libraries automatically, which takes a minute. On a desktop computer your browser then opens the site. If it doesn't, go to **http://localhost:5173**.
5. Keep the terminal window open while you use the site. Closing it, or pressing Ctrl+C, stops the site.

Data is stored in SQLite at `data/bracket.db`, using the database built into Node.js, so nothing needs compiling. The API runs on port 3001 behind the scenes, and Vite proxies `/api` to it.

### If it doesn't work

| What you see | Fix |
| --- | --- |
| `npm.ps1 cannot be loaded because running scripts is disabled` (PowerShell) | Type `npm.cmd run dev` instead, or double-click `start-windows.cmd`. To fix it for good, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and answer `Y`. |
| `'npm' is not recognized…` | Node.js isn't installed, or the terminal was opened before installing it. Install it, then open a new terminal. |
| `Could not read package.json` / `ENOENT` | The terminal isn't in the project folder. `cd` into the folder that contains `package.json`. |
| `Your Node.js is version …` | Install the current LTS from nodejs.org, then open a new terminal. |
| `Port … is already in use` | The site is already running in another window. Use that one, or close it first. |
| Browser says *This site can't be reached* | The terminal window was closed, or the command stopped with an error. Check the terminal. |

### How a pool works

1. **Sign up** (username + password, no email needed) and click **New pool**.
2. **Pick a league.** Set the pool name, the lock time (usually the first game's start) and scoring.
3. **Add the teams** to their seeds. Pro leagues have dropdowns with every team; college and custom brackets use free text, and there's a *Paste a list* shortcut.
4. **Share the invite link.** Friends sign up and join, then fill out their brackets. *Fill with favorites* and *Coin-flip the rest* help anyone in a hurry.
5. At the lock time, brackets freeze and everyone's picks become visible.
6. The commissioner opens **Results** and clicks the winner of each game or series. The leaderboard updates on save.

### Scoring

Each correct winner is worth the points set for its round. The defaults double every round, and the commissioner can change them any time. Picks are graded by round: you get the points if the team you picked really won a game in that round. This keeps re-seeded NFL brackets fair.

- **Series score bonus** (NBA, NHL, MLB, MLS Round One, WNBA): each series card has one-tap score buttons for both teams (for example NYY 2–0 / 2–1 and BOS 2–0 / 2–1 in a best-of-3). Calling the exact score earns optional extra points.
- **Max** is the most points a bracket can still reach, given which teams have been eliminated.
- **Ties** are broken by how close your tiebreaker guess is to the actual number (for example, total points in the Super Bowl). The commissioner enters that number with the results.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev server with hot reload |
| `npm run build` | Build the frontend into `dist/client` |
| `npm start` | Production server: API + built frontend on one port (builds first if needed) |
| `npm test` | Unit and API tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run check` | All of the above |

## Deploying

The production server is a single Node process that serves both the API and the built site. It needs a persistent disk for the SQLite file.

```bash
npm ci
npm run build
DATABASE_PATH=/var/lib/bracket/bracket.db PORT=3001 npm start
```

Or use Docker (mount a volume at `/data`):

```bash
docker build -t bracket-club .
docker run -p 3001:3001 -v bracket-data:/data bracket-club
```

This works on any host with persistent volumes, such as Fly.io, Railway or a small VPS. Put it behind HTTPS.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3001` | |
| `DATABASE_PATH` | `data/bracket.db` | SQLite file; back it up occasionally |
| `SECURE_COOKIES` | automatic | Login cookies are marked Secure when the site is reached over HTTPS. Set `true`/`false` to force it |

## Project layout

```
src/
  shared/     bracket engine used by both server and client
    templates.ts  every league's playoff format
    teams.ts      team lists and colours
    bracket.ts    pick resolution, re-seeding, scoring, ranking
    layout.ts     positions for the two-sided bracket drawing
  server/     Express API on Node's built-in SQLite (auth, pools, brackets, invites)
  client/     React app (Vite)
tests/        engine and API tests
```

Adding a new format means adding a template in `src/shared/templates.ts`. A template is a list of seed slots and matches, where each match takes its teams from a seed, the winner of an earlier match, or a re-seeded pool. The tests check that every template forms a valid bracket.

## Notes

- Seeds and results are entered by the pool's commissioner. Nothing is pulled from a live data feed, so it works for any league and season.
- Passwords are hashed with scrypt, and sessions use HTTP-only cookies. There is no email or password reset yet. A logged-in user can change their password under Account.
- Not affiliated with any league. Team names and colours belong to their owners.
