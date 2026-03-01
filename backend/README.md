# Winloop Backend

Node.js + PostgreSQL API. All game logic and validations run server-side.

## Setup

1. Copy `.env.example` to `.env` and set values (PostgreSQL user/password, JWT_SECRET, etc.).
2. Install: `npm install`
3. Create DB and tables: `npm run migrate`
4. Start: `npm start` or `npm run dev`
5. **Or with PM2:** From `backend/` run `npm run pm2:start` (PM2 is local; use `npm run pm2:stop` / `pm2:restart` / `pm2:logs` / `pm2:status`). To stop what's on port 3100: `npm run kill-port`.
6. **EADDRINUSE 3100:** Port already in use. Run `npm run kill-port` or `npm run pm2:stop` if API was started with PM2.
7. Seed test data (incl. admin user): `npm run seed`

## Test data (after seed)

- **Admin:** email `admin@winloop.test`, password `admin123`
- i18n (TR/EN), morning questions (Wordle words), dungeon items, boss type, action roll symbols, boss event for today.

## Environment (.env)

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL (default: postgres/postgres, DB: winloop).
- `JWT_SECRET`, `JWT_EXPIRES_IN` — JWT for mobile auth.
- `UPLOAD_DIR`, `MAX_FILE_SIZE_MB` — File service.
- `CORS_ORIGINS` — Comma-separated or `*`.

## Security

- All actions (scores, points, ads, boss) must be validated and applied server-side.
- JWT middleware for protected routes; file upload/serve by GUID.
- Helmet, CORS, rate limiting enabled.

## File service

- `POST /api/files/upload` — multipart `file`; returns `{ guid }`.
- `GET /api/files/:guid` — serve file by GUID.

## API prefix

Default `/api`. Health: `GET /api/health`.
