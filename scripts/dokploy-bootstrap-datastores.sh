#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  DOKPLOY_TOKEN=... ./scripts/dokploy-bootstrap-datastores.sh

Optional environment variables:
  DOKPLOY_URL            Dokploy API base URL. Default: http://localhost:3000/api
  STAGING_PROJECT_NAME   Default: vizuo-staging
  STAGING_ENV_NAME       Default: staging
  PROD_PROJECT_NAME      Default: vizuo-prod
  PROD_ENV_NAME          Default: production
  DB_NAME                Default: vizuo
  DB_USER                Default: vizuo
  POSTGRES_IMAGE         Default: postgres:16
  REDIS_IMAGE            Default: redis:7

What it does:
  1. Looks up the two Dokploy projects by name
  2. Creates the requested environment in each project if missing
  3. Creates internal-only Postgres + Redis for each environment if missing
  4. Deploys the created databases

Notes:
  - Requires: curl, jq, openssl
  - Keep DOKPLOY_TOKEN local. Do not paste it into chat or commit it.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq
require_cmd openssl

: "${DOKPLOY_TOKEN:?Set DOKPLOY_TOKEN first.}"

DOKPLOY_URL="${DOKPLOY_URL:-http://localhost:3000/api}"
STAGING_PROJECT_NAME="${STAGING_PROJECT_NAME:-vizuo-staging}"
STAGING_ENV_NAME="${STAGING_ENV_NAME:-staging}"
PROD_PROJECT_NAME="${PROD_PROJECT_NAME:-vizuo-prod}"
PROD_ENV_NAME="${PROD_ENV_NAME:-production}"
DB_NAME="${DB_NAME:-vizuo}"
DB_USER="${DB_USER:-vizuo}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16}"
REDIS_IMAGE="${REDIS_IMAGE:-redis:7}"

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -fsS -X "$method" \
      "$DOKPLOY_URL/$path" \
      -H "x-api-key: $DOKPLOY_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -fsS -X "$method" \
      "$DOKPLOY_URL/$path" \
      -H "x-api-key: $DOKPLOY_TOKEN"
  fi
}

generate_secret() {
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9@#%^&*()_+=[]{}|;:,.<>?~-' | head -c 32
}

find_project_id() {
  local project_name="$1"

  api GET "project.all" | jq -r --arg name "$project_name" '.[] | select(.name == $name) | .projectId' | head -n1
}

ensure_environment() {
  local project_id="$1"
  local env_name="$2"
  local env_id

  env_id="$(
    api GET "environment.byProjectId?projectId=$project_id" \
      | jq -r --arg name "$env_name" '.[] | select(.name == $name) | .environmentId' \
      | head -n1
  )"

  if [[ -n "$env_id" ]]; then
    echo "$env_id"
    return 0
  fi

  echo "Creating environment '$env_name'..."
  api POST "environment.create" "$(jq -nc --arg name "$env_name" --arg projectId "$project_id" '{name: $name, projectId: $projectId}')" >/dev/null

  env_id="$(
    api GET "environment.byProjectId?projectId=$project_id" \
      | jq -r --arg name "$env_name" '.[] | select(.name == $name) | .environmentId' \
      | head -n1
  )"

  if [[ -z "$env_id" ]]; then
    echo "Failed to create or locate environment '$env_name'." >&2
    exit 1
  fi

  echo "$env_id"
}

find_postgres_id() {
  local project_id="$1"
  local name="$2"

  api GET "project.all" | jq -r --arg projectId "$project_id" --arg name "$name" '
    .[] | select(.projectId == $projectId) | .postgres[]? | select(.name == $name) | .postgresId
  ' | head -n1
}

find_redis_id() {
  local project_id="$1"
  local name="$2"

  api GET "project.all" | jq -r --arg projectId "$project_id" --arg name "$name" '
    .[] | select(.projectId == $projectId) | .redis[]? | select(.name == $name) | .redisId
  ' | head -n1
}

ensure_postgres() {
  local project_id="$1"
  local environment_id="$2"
  local name="$3"
  local app_name="$4"
  local postgres_id
  local password

  postgres_id="$(find_postgres_id "$project_id" "$name")"
  if [[ -n "$postgres_id" ]]; then
    echo "Postgres '$name' already exists."
    echo "$postgres_id"
    return 0
  fi

  password="$(generate_secret)"
  echo "Creating Postgres '$name'..."
  api POST "postgres.create" "$(
    jq -nc \
      --arg name "$name" \
      --arg appName "$app_name" \
      --arg databaseName "$DB_NAME" \
      --arg databaseUser "$DB_USER" \
      --arg databasePassword "$password" \
      --arg dockerImage "$POSTGRES_IMAGE" \
      --arg environmentId "$environment_id" \
      '{
        name: $name,
        appName: $appName,
        databaseName: $databaseName,
        databaseUser: $databaseUser,
        databasePassword: $databasePassword,
        dockerImage: $dockerImage,
        environmentId: $environmentId
      }'
  )" >/dev/null

  postgres_id="$(find_postgres_id "$project_id" "$name")"
  if [[ -z "$postgres_id" ]]; then
    echo "Postgres '$name' was created but could not be looked up." >&2
    exit 1
  fi

  api POST "postgres.saveExternalPort" "$(jq -nc --arg postgresId "$postgres_id" '{postgresId: $postgresId, externalPort: null}')" >/dev/null
  api POST "postgres.deploy" "$(jq -nc --arg postgresId "$postgres_id" '{postgresId: $postgresId}')" >/dev/null

  echo "Created Postgres '$name'. Save this password securely:"
  echo "  $password"
  echo "$postgres_id"
}

ensure_redis() {
  local project_id="$1"
  local environment_id="$2"
  local name="$3"
  local app_name="$4"
  local redis_id
  local password

  redis_id="$(find_redis_id "$project_id" "$name")"
  if [[ -n "$redis_id" ]]; then
    echo "Redis '$name' already exists."
    echo "$redis_id"
    return 0
  fi

  password="$(generate_secret)"
  echo "Creating Redis '$name'..."
  api POST "redis.create" "$(
    jq -nc \
      --arg name "$name" \
      --arg appName "$app_name" \
      --arg databasePassword "$password" \
      --arg dockerImage "$REDIS_IMAGE" \
      --arg environmentId "$environment_id" \
      '{
        name: $name,
        appName: $appName,
        databasePassword: $databasePassword,
        dockerImage: $dockerImage,
        environmentId: $environmentId
      }'
  )" >/dev/null

  redis_id="$(find_redis_id "$project_id" "$name")"
  if [[ -z "$redis_id" ]]; then
    echo "Redis '$name' was created but could not be looked up." >&2
    exit 1
  fi

  api POST "redis.saveExternalPort" "$(jq -nc --arg redisId "$redis_id" '{redisId: $redisId, externalPort: null}')" >/dev/null
  api POST "redis.deploy" "$(jq -nc --arg redisId "$redis_id" '{redisId: $redisId}')" >/dev/null

  echo "Created Redis '$name'. Save this password securely:"
  echo "  $password"
  echo "$redis_id"
}

bootstrap_stack() {
  local project_name="$1"
  local env_name="$2"
  local suffix="$3"
  local project_id
  local environment_id

  project_id="$(find_project_id "$project_name")"
  if [[ -z "$project_id" ]]; then
    echo "Could not find Dokploy project '$project_name'." >&2
    exit 1
  fi

  environment_id="$(ensure_environment "$project_id" "$env_name")"
  echo "Using environment '$env_name' ($environment_id) in project '$project_name'."

  ensure_postgres "$project_id" "$environment_id" "postgres-$suffix" "postgres-$suffix"
  ensure_redis "$project_id" "$environment_id" "redis-$suffix" "redis-$suffix"
}

bootstrap_stack "$STAGING_PROJECT_NAME" "$STAGING_ENV_NAME" "stg"
bootstrap_stack "$PROD_PROJECT_NAME" "$PROD_ENV_NAME" "prod"

echo "Dokploy datastore bootstrap finished."
