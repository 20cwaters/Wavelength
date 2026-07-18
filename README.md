# Wavelength

A multiplayer web version of the spectrum-guessing party game, with two modes:

- **🎉 Party (default, like the official mobile app):** no teams. At game start every player
  secretly writes clues for a few dials (each with its own spectrum + hidden target). The dials are
  shuffled and come up one at a time; everyone except the clue writer guesses on their **own
  private dial**. Guessers score by closeness (4/3/2/0), the clue writer earns the average of the
  guessers' points, and the highest total after all dials wins.
- **⚔️ Teams (classic board game):** one Psychic per round sees a hidden target plus a spectrum
  pair (e.g. "Cold ↔ Hot"), gives a single clue, and their team moves a shared live-synced dial to
  find the bullseye. The opposing team can steal a bonus point by calling which side of the locked
  pointer the true target is on. First team to the winning score takes it.

## Stack

- **Client:** React + TypeScript + Tailwind CSS (Vite)
- **Server:** Node.js + Express + Socket.IO (in-memory state, no database)
- **Shared:** `shared/` holds all game logic, types, and the topic library — imported by both sides

## Running locally

```bash
npm install          # installs both workspaces

# dev (two terminals):
npm run dev:server   # Socket.IO + API on :3001
npm run dev:client   # Vite on :5173 (proxies /socket.io to :3001)
```

Open http://localhost:5173. Each browser **tab** is a separate player (identity is per-tab), so you
can test multiplayer alone by opening several tabs. Refreshing a tab reconnects to the same seat.

```bash
npm test             # vitest unit tests (scoring, bonus logic, rotation, validation, topic draw)
npm run typecheck    # tsc for client + server
npm run build        # builds client, then bundles server to server/dist
npm start            # production mode: one server on :3001 serving the built client
```

## Deploying to Render

The repo includes `render.yaml`, so you can create a **Blueprint** from it, or configure a single
Web Service manually:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/healthz`

One service does everything — Express serves the built client and Socket.IO shares the same port
(Render's `PORT` env var is respected). Note: game state is in memory, so a deploy/restart clears
active rooms; idle rooms are garbage-collected after ~30 minutes.

## Project layout

```
shared/            game rules as pure functions + types + topic decks
  constants.ts     tuning knobs (wedge width, dial range, limits)
  game.ts          scoring, bonus resolution, psychic rotation, card drawing
  topics.ts        5 preset decks (80 pairs) — add new decks here
  types.ts         socket protocol + view models
  game.test.ts     unit tests
server/src/
  rooms.ts         Room/RoomManager: state machine, hidden-info-safe views, disconnect handling
  index.ts         Express + Socket.IO wiring, static serving
client/src/
  useGame.tsx      socket state hook (reconnect, throttled pointer sync, actions)
  components/      JoinPage, Lobby, Game, Dial, modals, tutorial tips
```

## Game-design notes

- **Scoring wedges** are `WEDGE_WIDTH`° each (default 7): 4 points within ±3.5°, 3 within ±10.5°,
  2 within ±17.5°, else 0. Change `WEDGE_WIDTH` in `shared/constants.ts` to retune difficulty.
- **Hidden info:** the server builds a per-player view every broadcast — targets never leave the
  server except to their author/Psychic (and to everyone at reveal). Party-mode guesses stay
  private until the reveal, where they all appear as labeled markers on one dial.
- **Party mode details:** clues-per-player is configurable (1–5, default 2); total dials = players
  × clues. The host can force-start if someone stalls during clue writing (their unwritten clues
  are dropped) or skip a dial mid-guess. Players who join mid-game just guess (no authored dials).
  The clue writer's reward is the rounded average of the guessers' points.
- **Teams bonus point** follows the standard rule: no bonus is available when the guessing team
  scores a bullseye; the opposing team votes and majority decides (tie = no guess).
- **Teams 2-player support:** when the Psychic has no teammates, the opposing team moves the dial
  and the bonus guess is skipped for that round.
- **Teams ties at the winning score** trigger sudden death — play continues until one team leads.
- **Topic sources:** presets / custom-only / mix. In mix mode, custom topics get a 50/50 draw so
  player submissions actually show up. Custom-only falls back to presets until someone submits one.
