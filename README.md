# Winloop

Daily 3-mode mobile game: Morning puzzle/quiz, Midday roguelike dungeon, Evening social boss battle. Built with Node.js (Express + PostgreSQL) and React Native (Expo).

## Repository structure

- **`backend/`** — API (auth, morning game, dungeon, file service). Port **3100**, prefix `/api`.
- **`mobile/`** — React Native (Expo) app: auth, morning game, dungeon (D-pad + assets).
- **`docs/`** — Project plan, DB schema, MVP plan.
- **`2D Pixel Dungeon Asset Pack/`** — Dungeon art source; used assets are copied under `mobile/assets/dungeon/`.

## First-time setup (manual)

1. **PostgreSQL**: Create DB `winloop` and ensure it is running (default: `postgres`/`postgres`, port 5432).
2. **Backend**:  
   `cd backend` → copy or create `.env` (see below) → `npm install` → `npm run migrate` → `npm run seed` → `npm run dev`.
3. **Mobile**:  
   `cd mobile` → `npm install` → `npm start` (Expo). Point device/emulator to backend (e.g. Android: `10.0.2.2:3100`, iOS: `localhost:3100`).

Backend `.env` (optional; defaults work for local Postgres):

```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=winloop
PORT=3100
JWT_SECRET=your-secret
```

---

## Cursor: first-run setup (copy this prompt)

Copy the block below into Cursor Chat so the AI can set up and run the project from a fresh clone.

```
This is the Winloop repo (backend = Node + PostgreSQL, mobile = React Native Expo). I just cloned it. Do the following in order and run commands in the project root or the correct subfolder:

1) Backend setup
- Run: cd backend && npm install
- If backend/.env does not exist, create it with at least: PGHOST=localhost, PGPORT=5432, PGUSER=postgres, PGPASSWORD=postgres, PGDATABASE=winloop, PORT=3100, JWT_SECRET=dev-secret-change-in-prod
- Ensure PostgreSQL is running and a database named "winloop" exists (create it if not: createdb winloop or via psql).
- Run: cd backend && npm run migrate
- Run: cd backend && npm run seed
- Start the API: cd backend && npm run dev (leave it running or run in background; API must be up for the app to work).

2) Mobile setup
- Run: cd mobile && npm install
- Start the app: cd mobile && npm start (then choose iOS/Android or scan QR with Expo Go).

3) Tell me when both backend and mobile are running, and remind me: for Android emulator use API base 10.0.2.2:3100, for iOS simulator use localhost:3100 (see mobile/src/config/api.js if needed).
```

---

## Links

- **Repo:** [github.com/cemcatakk/Winloop](https://github.com/cemcatakk/Winloop)
