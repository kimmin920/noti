#!/bin/sh
set -eu

until nc -z postgres 5432; do
  echo "[worker] waiting for postgres..."
  sleep 1
done

until nc -z redis 6379; do
  echo "[worker] waiting for redis..."
  sleep 1
done

npm run prisma:generate -w @publ/database

if [ -f apps/worker/dist/index.js ]; then
  node apps/worker/dist/index.js
elif [ -f apps/worker/dist/src/index.js ]; then
  node apps/worker/dist/src/index.js
else
  echo "[worker] build output not found in apps/worker/dist" >&2
  find apps/worker/dist -maxdepth 3 -type f 2>/dev/null || true
  exit 1
fi
