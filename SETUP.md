# ZameenEye AI - Backend Setup & Reference

Quick reference for anyone touching the backend. Written to save you from re-debugging things that already cost time once.

---

## Environment Setup

Create a `.env` file in the **project root** (same level as `package.json`, NOT inside `src/`):

```
DATABASE_URL=postgresql://postgres.<project_ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**Important:** use the **Session Pooler** connection string from Supabase (Connect button → Session pooler tab), not the Direct connection string. Direct connection defaults to IPv6, which fails to resolve on many networks (`getaddrinfo failed` error). Session pooler is IPv4-compatible and behaves like a normal persistent connection, unlike the Transaction pooler (port 6543), which doesn't support the session-level behavior TypeORM and pgAdmin need.

---

## Running Things

```bash
npm install                  # install dependencies
npm run dev                  # start the server (http://localhost:3000)
npm run migration:run        # apply pending migrations
npm run migration:status     # check which migrations have run
npm run seed:run             # apply pending seeds
```

`npm run dev` connects to the DB first, then starts listening. If it fails, check `.env` location and the connection string format before anything else.

---

## Project Structure

```
src/
  config/database.ts     → TypeORM DataSource config
  entities/               → Tenant, User, Land, DisasterEvent
  migrations/             → hand-written migrations (numbered sequentially: 0001, 0002...)
  seeds/                  → same pattern as migrations, for seed data
  scripts/runner.ts       → custom migration/seed runner (tracks via _migrations/_seeds tables)
  services/               → business logic (DB queries live here)
  controllers/            → request/response handling, calls services
  routes/                 → Express route definitions
  app.ts                  → Express app, mount new routers here
  server.ts               → startup script (connects DB, then starts listening)
```

**To add a new route:** write the logic in `services/`, wire it up in `controllers/`, define the path in `routes/`, then mount that router in `app.ts`.

**Abu Bakr's webhook router mounts here too** — add it in `app.ts` alongside `spatialRoutes`, don't create a second entrypoint.

---

## Migrations

Migrations are plain functions, not TypeORM's native class-based migrations:

```typescript
export const up = async (dataSource: DataSource) => { /* ... */ }
export const down = async (dataSource: DataSource) => { /* ... */ }
```

Name them sequentially: `0001_description.ts`, `0002_description.ts`, etc. Don't mix timestamp-based and sequential naming, the runner sorts filenames alphabetically to determine execution order.

**Do not add a `migrations` field to `database.ts`'s DataSource config.** TypeORM 1.0 tries to auto-load and construct migration files as classes if that field is present, which crashes against our function-based migration files (`migrationClass is not a constructor`). Our custom runner (`scripts/runner.ts`) handles migration execution directly via `fs.readdirSync` + `require()`, it never relies on that field.

---

## Core Schema

- **Tenant** — organization or region grouping (`type`: agency/farmer_org, `country`: Pakistan/India/Kenya)
- **User** — person (`role`: farmer/agency_admin, `preferred_language`: urdu/hindi/swahili/tamil, sourced from their profile, never derived from country)
- **Land** — polygon owned by a User, belongs to a Tenant (`geom`: PostGIS Polygon, SRID 4326)
- **DisasterEvent** — hazard data from NASA FIRMS/UNOSAT/Copernicus (`geom`: PostGIS Point, SRID 4326)

Both `Land.geom` and `DisasterEvent.geom` have GIST spatial indexes, required for `ST_Intersects()` queries to run fast instead of full table scans.

---

## `/spatial-check` Contract

`POST /spatial-check` — body: `{ "landId": "uuid" }`

Returns:

```json
{
  "land": {
    "id": "uuid",
    "label": "string",
    "country": "Pakistan | India | Kenya"
  },
  "owner": {
    "name": "string",
    "phone_number": "string",
    "role": "farmer | agency_admin",
    "preferred_language": "urdu | hindi | swahili | tamil"
  },
  "has_active_hazard": true,
  "intersecting_events": [
    {
      "source": "nasa_firms",
      "detected_at": "2026-07-04T10:00:00Z",
      "raw_payload": {
        "confidence": 85,
        "intensity": 340,
        "detected_at": "2026-07-04T10:00:00Z"
      }
    }
  ]
}
```

Notes:
- Always returned, even when `has_active_hazard` is false, Thammnah's prompt builder uses this for an "all clear" message path.
- `intersecting_events` includes **all** geometrically intersecting events regardless of confidence, for context. `has_active_hazard` only flips true if at least one event's confidence exceeds 70.
- `raw_payload` keys are normalized (`intensity` replaces source-specific fields like `brightness`/`FRP`), this normalization happens in `/ingest/firms` at write time, not read time.
- `preferred_language` is nullable until every farmer's profile actually sets it. Confirm with Thammnah how her side should handle `null`.

---

## Known Gotchas

- **`.env` in the wrong folder** silently produces `undefined` for all env vars, dotenv fails quietly, no error thrown. Always confirm with `dir .env` from project root.
- **TypeORM entity filenames must match import casing.** Windows ignores case, Linux (deployment target) doesn't. Keep imports consistent with actual filenames to avoid deploy-time breakage.
- **`gen_random_uuid()`** requires Postgres 13+ or the `pgcrypto` extension. Supabase supports it natively, no action needed, but worth knowing if this ever moves elsewhere.
- **Rotate the Supabase DB password** if it's ever pasted in a chat, doc, or commit by mistake. Reset via Project Settings → Database.

---

*Last updated: July 2026. Update this file when the schema or `/spatial-check` contract changes, don't let it go stale.*