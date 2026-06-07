#!/usr/bin/env bash
# One-shot local E2E for @rfjs/jsonb-query: ensure the PG 11.16 + 16 docker
# containers exist, wait for readiness, then run the vitest e2e suite.
#
# Usage:
#   pnpm -F @rfjs/jsonb-query test:e2e          # start (if needed) + run
#   pnpm -F @rfjs/jsonb-query test:e2e:down     # remove the containers
#
# CI equivalent: .github/workflows/ci-e2e-jsonb-query.yml (service containers).
set -euo pipefail

PG11_NAME=jsonb-e2e-pg11
PG16_NAME=jsonb-e2e-pg16
PG11_PORT=54311
PG16_PORT=54316

if [[ "${1:-}" == "--down" ]]; then
  docker rm -f "$PG11_NAME" "$PG16_NAME" >/dev/null 2>&1 || true
  echo "e2e containers removed"
  exit 0
fi

ensure() { # name image port
  if ! docker ps --format '{{.Names}}' | grep -qx "$1"; then
    docker rm -f "$1" >/dev/null 2>&1 || true
    docker run -d --name "$1" -e POSTGRES_PASSWORD=e2e -p "$3:5432" "$2" >/dev/null
    echo "started $1 ($2 on :$3)"
  fi
}

ensure "$PG11_NAME" postgres:11.16 "$PG11_PORT"
ensure "$PG16_NAME" postgres:16-alpine "$PG16_PORT"

for name in "$PG11_NAME" "$PG16_NAME"; do
  ready=0
  for _ in $(seq 1 30); do
    if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ $ready -ne 1 ]]; then
    echo "$name not ready after 30s" >&2
    exit 1
  fi
done

export PG_E2E_URLS="postgres://postgres:e2e@localhost:${PG11_PORT}/postgres,postgres://postgres:e2e@localhost:${PG16_PORT}/postgres"
pnpm run vitest:e2e:run
