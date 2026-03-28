#!/bin/sh
set -eu

sh docker/wait-for-url.sh api DATABASE_URL 5432

npm run prisma:generate -w @publ/database
npm run prisma:migrate -w @publ/database

node apps/api/dist/main.js
