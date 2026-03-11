#!/bin/sh
set -eu

until nc -z postgres 5432; do
  echo "[api] waiting for postgres..."
  sleep 1
done

npm run prisma:generate -w @publ/database
npm run prisma:migrate -w @publ/database
npm run prisma:seed -w @publ/database

node apps/api/dist/main.js
