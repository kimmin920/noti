#!/bin/sh
set -eu

until nc -z postgres 5432; do
  echo "[poller] waiting for postgres..."
  sleep 1
done

npm run prisma:generate -w @publ/database

node apps/poller/dist/index.js
