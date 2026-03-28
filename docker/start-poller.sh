#!/bin/sh
set -eu

sh docker/wait-for-url.sh poller DATABASE_URL 5432

npm run prisma:generate -w @publ/database

node apps/poller/dist/index.js
