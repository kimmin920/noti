#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
else
  echo "[dev-boot] .env file not found. Create it from .env.example first."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev-boot] docker command not found. Install Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  if command -v open >/dev/null 2>&1; then
    echo "[dev-boot] Starting Docker Desktop..."
    open -a Docker || true
  fi

  echo "[dev-boot] Waiting for Docker daemon..."
  until docker info >/dev/null 2>&1; do
    sleep 2
  done
fi

stop_project_process_on_port() {
  port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
  if [ -z "$pids" ]; then
    return 0
  fi

  for pid in $pids; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"

    case "$cmd" in
      *"$ROOT_DIR"*|*"dist/main.js"*|*"next/dist"*|*"next-server"*|*"prisma studio"*)
        echo "[dev-boot] Releasing port $port from project process (pid $pid)..."
        kill "$pid" >/dev/null 2>&1 || true
        sleep 1
        kill -9 "$pid" >/dev/null 2>&1 || true
        ;;
      *)
        echo "[dev-boot] Port $port is already in use by another process:"
        echo "  $cmd"
        echo "[dev-boot] Stop it manually, or change the port before running dev:boot."
        exit 1
        ;;
    esac
  done
}

echo "[dev-boot] Starting postgres and redis containers..."
docker compose stop api worker poller admin >/dev/null 2>&1 || true
docker compose up -d postgres redis

stop_project_process_on_port 3000
stop_project_process_on_port 3001

echo "[dev-boot] Running Prisma generate/migrate/seed..."
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

echo "[dev-boot] Launching app dev servers and Prisma Studio..."
npx concurrently -n app,studio -c green,cyan "npm run dev" "npx prisma studio --schema packages/database/prisma/schema.prisma"
