#!/bin/sh
set -eu

sh docker/wait-for-url.sh api DATABASE_URL 5432

npm run prisma:generate -w @publ/database

attempt=0
until npm run prisma:migrate -w @publ/database; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[api] prisma migrate failed after $attempt attempts" >&2
    exit 1
  fi

  echo "[api] prisma migrate not ready yet (attempt $attempt/30), retrying..."
  sleep 2
done

node apps/api/dist/main.js
