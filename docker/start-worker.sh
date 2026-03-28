#!/bin/sh
set -eu

sh docker/wait-for-url.sh worker DATABASE_URL 5432
sh docker/wait-for-url.sh worker REDIS_URL 6379

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
