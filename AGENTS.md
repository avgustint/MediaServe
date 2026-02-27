# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

MediaServer is a digital signage / media player monorepo with three components:

| Service | Directory | Dev Port | Start Command |
|---------|-----------|----------|---------------|
| **Server** (Node.js/Express + SQLite + WebSocket) | `server/` | 8080 | `cd server && npm start` |
| **Admin** (Angular 20, PrimeNG) | `admin/` | 4201 | `cd admin && npx ng serve --port 4201 --host 0.0.0.0` |
| **Client** (Angular 20, display/kiosk) | `client/` | 4200 | `cd client && npx ng serve --port 4200 --host 0.0.0.0` |

Default credentials: **admin / admin** (location: Solkan).

### Running services

- Start all three at once from the root: `npm start` (uses `node scripts/start.js`)
- Or use `npm run start:dev` which uses `concurrently` to start all three in parallel.
- The server auto-creates the SQLite database at `server/data/mediaserver.db` on first run.

### Important caveats

- **No lint scripts**: The project has no ESLint configuration or lint scripts. There is no `npm run lint` command.
- **API routes have no `/api/` prefix**: Routes are mounted at root (e.g., `POST /login`, `GET /library`, `GET /playlist`). The `/api/keyboard` route is an exception.
- **Port note**: The README claims admin=4200 and client=4201, but the actual `package.json` scripts use admin=4201 and client=4200. Always trust the `package.json` scripts.
- **Admin tests require `--browsers=ChromeHeadlessCI`** in headless environments. The root `npm test` command already includes this flag. Run via `npm test` from the root, or `cd admin && npm test -- --browsers=ChromeHeadlessCI`.
- **Login requires `locationId`**: The `POST /login` endpoint requires `username`, `password`, and `locationId` (use `GET /locations` to find valid IDs).

### Testing

See `docs/TESTING.md` for details. Quick reference:
- Server tests: `npm run test:server` (Node.js built-in test runner)
- Admin tests: `npm run test:admin` (Karma + Jasmine with ChromeHeadlessCI)
- All tests: `npm test`
