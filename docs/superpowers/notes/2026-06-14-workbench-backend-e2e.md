# Workbench Backend E2E Run Log

**Date:** 2026-06-14  
**Task:** Task 13 — end-to-end create→list round-trip  
**Stack:** real Postgres → @rfjs/db migrate/seed → @rfjs/core → apps/api → apps/workbench  
**Worktree:** `.claude/worktrees/feat+workbench-backend-foundation`

---

## Step 0: Build libs

```bash
pnpm --filter @rfjs/db build
pnpm --filter @rfjs/core build
```

**Output (@rfjs/db):**
```
> @rfjs/db@0.0.0 build
> pnpm run clean && tsdown --config-loader unrun

ℹ tsdown v0.17.0-beta.6 powered by rolldown v1.0.0-beta.53
ℹ config file: libs/db/tsdown.config.ts (unrun)
ℹ entry: src/index.ts
ℹ Build start
ℹ [CJS] dist/index.js       7.26 kB │ gzip: 2.25 kB
ℹ [CJS] dist/index.d.ts     5.17 kB │ gzip: 1.11 kB
ℹ [ESM] dist/index.mjs      6.36 kB │ gzip: 2.04 kB
ℹ [ESM] dist/index.d.mts    5.13 kB │ gzip: 1.10 kB
✔ Build complete in 721ms
Copied: libs/db/drizzle → dist/drizzle
```

**Output (@rfjs/core):**
```
> @rfjs/core@0.0.0 build
> pnpm run clean && tsdown --config-loader unrun

ℹ tsdown v0.17.0-beta.6 powered by rolldown v1.0.0-beta.53
ℹ entry: src/index.ts
ℹ [CJS] dist/index.js      2.13 kB │ gzip: 0.71 kB
ℹ [CJS] dist/index.d.ts    1.67 kB │ gzip: 0.53 kB
ℹ [ESM] dist/index.mjs     1.85 kB │ gzip: 0.67 kB
ℹ [ESM] dist/index.d.mts   1.68 kB │ gzip: 0.53 kB
✔ Build complete in 734ms
```

Both packages built successfully.

---

## Step 1: Bring up Postgres (host port 5433)

```bash
docker compose -f docker-compose.test.yml up -d
for i in $(seq 1 20); do
  docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U user && break
  sleep 1
done
```

**Output:**
```
Container featworkbench-backend-foundation-postgres-test-1 Started

/var/run/postgresql:5432 - accepting connections
Postgres ready after 1 attempts
```

---

## Step 2: Migrate + Seed

```bash
export DBURL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench'
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db migrate
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db seed
```

**Migration output:**
```
> @rfjs/db@0.0.0 migrate
> pnpm exec tsx src/scripts/run-migrate.ts

Database "workbench" does not exist. Creating...
Database "workbench" created successfully.
Migrations completed.
```

**Seed output:**
```
> @rfjs/db@0.0.0 seed
> pnpm exec tsx src/scripts/run-seed.ts

Seeded 2 datasets.
```

---

## Step 3: Start the API (background, DATABASE_URL set)

```bash
DATABASE_URL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench' \
  pnpm --filter api tsx > /tmp/api.log 2>&1 &
for i in $(seq 1 30); do
  curl -sf localhost:3000/health && break
  sleep 1
done
```

**Health check response (immediate, attempt 1):**
```json
{"status":"ok","timestamp":"2026-06-14T08:05:22.039Z","uptime":4.318064904,"version":"0.0.0","environment":"local"}
```

**API startup log (tail -20):**
```
INFO [2026-14-06T08:05:18.220+0000]: Server listening at http://127.0.0.1:3000
INFO [2026-14-06T08:05:18.220+0000]: Server listening at http://0.0.0.0:3000
INFO [2026-14-06T08:05:18.220+0000]: App name: starter-ts-fastify
INFO [2026-14-06T08:05:18.220+0000]: Environment: local
INFO [2026-14-06T08:05:22.038+0000]: incoming request {"reqId":"req-1","req":{"method":"GET","url":"/health",...}}
INFO [2026-14-06T08:05:22.041+0000]: request completed {"reqId":"req-1","res":{"statusCode":200},...}
server started!
```

---

## Step 4: Create → List → 404

### POST /datasets

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST localhost:3000/datasets \
  -H 'content-type: application/json' \
  -d '{"name":"E2E","data":{"k":1}}'
```

**Output:**
```
{"id":"95bd7b85-23fe-4bc5-8a09-794e90b33729","name":"E2E","description":null,"data":{"k":1},"createdAt":"2026-06-14T08:05:31.312Z","updatedAt":"2026-06-14T08:05:31.312Z"}
HTTP_STATUS:201
```

Status: 201 Created. Body contains `"name":"E2E"` and a valid UUID `id`.

### GET /datasets

```bash
curl -s localhost:3000/datasets
```

**Output:**
```json
[
  {"id":"c71bb1ec-6357-409c-994b-dbf0289060db","name":"Sales — Q1","description":"Demo seed","data":{"rows":120,"region":"apac"},"createdAt":"2026-06-14T08:05:11.166Z","updatedAt":"2026-06-14T08:05:11.166Z"},
  {"id":"194359ef-70b2-4f6a-9312-748757379466","name":"Signups","description":"Demo seed","data":{"rows":42,"region":"emea"},"createdAt":"2026-06-14T08:05:11.166Z","updatedAt":"2026-06-14T08:05:11.166Z"},
  {"id":"95bd7b85-23fe-4bc5-8a09-794e90b33729","name":"E2E","description":null,"data":{"k":1},"createdAt":"2026-06-14T08:05:31.312Z","updatedAt":"2026-06-14T08:05:31.312Z"}
]
```

Returns all 3 rows: 2 seeded ("Sales — Q1", "Signups") + 1 created ("E2E").

### GET /datasets/:id (bogus UUID — 404)

```bash
curl -s -o /dev/null -w "%{http_code}" localhost:3000/datasets/00000000-0000-0000-0000-000000000000
```

**Output:**
```
404
```

---

## Step 5: Workbench page server-rendered HTML

```bash
API_BASE_URL=http://localhost:3000 pnpm --filter workbench dev > /tmp/wb.log 2>&1 &
for i in $(seq 1 60); do
  curl -sf localhost:3001/en/datasets > /dev/null && break
  sleep 2
done
curl -s localhost:3001/en/datasets | grep -o -E 'Sales|Signups|E2E' | sort -u
```

**Boot time:** Ready after 2 seconds (first request check).

**Grep result:**
```
E2E
Sales
Signups
```

All three dataset names were found in the server-rendered HTML at `/en/datasets`. The full DB → API → workbench chain is confirmed.

---

## Step 6: Teardown

```bash
# Killed API (port 3000) and workbench (port 3001) by PID and lsof
kill 103355   # pnpm api parent
kill 106163   # pnpm workbench parent
kill $(lsof -ti :3000)   # tsx child (pid 103549)
kill 106272 106762       # next dev children

docker compose -f docker-compose.test.yml down
```

**Docker output:**
```
Container featworkbench-backend-foundation-postgres-test-1 Stopped
Container featworkbench-backend-foundation-postgres-test-1 Removed
Network featworkbench-backend-foundation_default Removed
```

Post-teardown verification:
- `curl -sf localhost:3000/health` → connection refused (API stopped)
- `curl -sf localhost:3001` → connection refused (Workbench stopped)

---

## Summary

| Step | Expected | Actual | Pass |
|------|----------|--------|------|
| @rfjs/db build | success | Build complete in 721ms | PASS |
| @rfjs/core build | success | Build complete in 734ms | PASS |
| Postgres up | healthy | accepting connections, attempt 1 | PASS |
| migrate | "Migrations completed." | Database created + "Migrations completed." | PASS |
| seed | "Seeded 2 datasets." | "Seeded 2 datasets." | PASS |
| GET /health | 200 ok | 200 `{"status":"ok",...}` | PASS |
| POST /datasets | 201 + id + name | 201 `{"id":"95bd7b85...","name":"E2E",...}` | PASS |
| GET /datasets | array with 3 rows | `[Sales — Q1, Signups, E2E]` | PASS |
| GET /datasets/:bogus | 404 | 404 | PASS |
| Workbench /en/datasets HTML | Sales, Signups, E2E | E2E, Sales, Signups | PASS |
| Teardown | all processes/containers down | confirmed stopped | PASS |
