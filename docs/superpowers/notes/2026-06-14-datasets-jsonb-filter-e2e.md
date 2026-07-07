# Datasets JSONB Filter — Full-Stack E2E Run Log

**Date:** 2026-06-14  
**Branch:** feat/datasets-jsonb-filter  
**Worktree:** `.claude/worktrees/feat+datasets-jsonb-filter`

---

## Step 1: Build libs

```bash
pnpm --filter @rfjs/jsonb-query build
pnpm --filter @rfjs/db build
pnpm --filter @rfjs/core build
```

All three built successfully (tsdown, ~400–630 ms each).

---

## Step 2: Postgres up, migrate, seed

```bash
docker compose -f docker-compose.test.yml up -d && sleep 6
export DBURL='postgresql://user:password@localhost:5433/workbench?options=-csearch_path=workbench'
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db migrate
DATABASE_URL="$DBURL" pnpm --filter @rfjs/db seed
```

**Observed output:**

```
Database "workbench" does not exist. Creating...
Database "workbench" created successfully.
Migrations completed.
Seeded 2 datasets.
```

---

## Step 3: Start API

```bash
DATABASE_URL="$DBURL" pnpm --filter api tsx > /tmp/api.log 2>&1 &
for i in $(seq 1 30); do curl -sf localhost:3000/health >/dev/null && break; sleep 1; done
```

API ready after 1 s.

---

## Step 4: Curl exercises

### Health

```bash
curl -s localhost:3000/health
```

```json
{"status":"ok","timestamp":"2026-06-14T11:43:33.513Z","uptime":8.781869818,"version":"0.0.0","environment":"local"}
```

---

### Filter: region = apac (expect Sales — Q1 only)

```bash
curl -s -X POST localhost:3000/datasets/query \
  -H 'content-type: application/json' \
  -d '{"filter":{"logic":"and","filters":[{"field":"region","dataType":"string","operator":"eq","value":"apac"}]}}'
```

```json
[{"id":"491f9b0f-720a-4be9-a73d-816e1fc9130b","name":"Sales — Q1","description":"Demo seed","data":{"rows":120,"region":"apac"},"createdAt":"2026-06-14T11:43:17.351Z","updatedAt":"2026-06-14T11:43:17.351Z"}]
```

Result: 1 row — "Sales — Q1" only. "Signups" (region=emea) excluded. PASS.

---

### Filter: rows >= 100 numeric (expect Sales — Q1 only)

```bash
curl -s -X POST localhost:3000/datasets/query \
  -H 'content-type: application/json' \
  -d '{"filter":{"logic":"and","filters":[{"field":"rows","dataType":"numeric","operator":"gte","value":100}]}}'
```

```json
[{"id":"491f9b0f-720a-4be9-a73d-816e1fc9130b","name":"Sales — Q1","description":"Demo seed","data":{"rows":120,"region":"apac"},"createdAt":"2026-06-14T11:43:17.351Z","updatedAt":"2026-06-14T11:43:17.351Z"}]
```

Result: 1 row — "Sales — Q1" (rows=120 >= 100). "Signups" (rows=42) excluded. PASS.

---

### Malformed operator -> expect 400

```bash
curl -s -X POST localhost:3000/datasets/query \
  -H 'content-type: application/json' \
  -d '{"filter":{"logic":"and","filters":[{"field":"region","dataType":"string","operator":"NOPE","value":"x"}]}}'
```

HTTP status: `400`

Response body:
```json
{"statusCode":400,"error":"Bad Request","message":"Invalid filter","code":"UNSUPPORTED_OPERATOR"}
```

PASS — JsonbQueryError caught at route layer, translated to 400.

---

### Malformed body shape (bad logic value) -> expect 400

```bash
curl -s -X POST localhost:3000/datasets/query \
  -H 'content-type: application/json' \
  -d '{"filter":{"logic":"xor","filters":[]}}'
```

HTTP status: `400`

Response body:
```json
{"statusCode":400,"error":"Bad Request","message":"Request validation failed","issues":[{"path":["filter","logic"],"message":"Invalid option: expected one of \"and\"|\"or\"|\"nor\"|\"not\""}]}
```

PASS — Zod schema validation at route entry, translated to 400.

---

## Step 5: Tear down

```bash
pkill -f 'apps/api' 2>/dev/null || true
docker compose -f docker-compose.test.yml down
```

Container `featdatasets-jsonb-filter-postgres-test-1` stopped and removed. Network removed.

---

## Summary

| Check | Expected | Observed | Result |
|---|---|---|---|
| Build (@rfjs/jsonb-query, @rfjs/db, @rfjs/core) | success | success | PASS |
| Migrate + Seed | "Migrations completed." + "Seeded 2 datasets." | exact match | PASS |
| Health | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | PASS |
| `region=apac` filter | `[{"name":"Sales — Q1",...}]` (1 row) | exact match | PASS |
| `rows >= 100` numeric filter | `[{"name":"Sales — Q1",...}]` (1 row) | exact match | PASS |
| Unknown operator `NOPE` | 400 `UNSUPPORTED_OPERATOR` | 400 `UNSUPPORTED_OPERATOR` | PASS |
| Bad logic value `xor` | 400 Zod validation error | 400 Zod validation error | PASS |

All checks PASS. Full chain verified: real Postgres → @rfjs/db seed → @rfjs/core search → apps/api POST /datasets/query.
