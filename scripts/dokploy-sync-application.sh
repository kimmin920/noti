#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  DOKPLOY_TOKEN=... ./scripts/dokploy-sync-application.sh \
    --project vizuo-staging \
    --environment staging \
    --name worker-stg \
    --git-url https://github.com/kimmin920/noti.git \
    --branch main \
    --build-path / \
    --dockerfile docker/worker.Dockerfile \
    --context . \
    --env-file /secure/path/worker-stg.env \
    --watch apps/worker/** \
    --watch packages/database/** \
    --watch packages/shared/** \
    --watch docker/worker.Dockerfile \
    --watch docker/start-worker.sh

Optional:
  --domain admin-stg.vizuo.work
  --port 3010
  --build-stage production

Notes:
  - Uses Dokploy REST API to create/update an Application, connect a Git provider,
    save environment variables, optionally attach a domain, and deploy.
  - Requires: curl, jq
  - Do not commit env files with secrets.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

: "${DOKPLOY_TOKEN:?Set DOKPLOY_TOKEN first.}"

DOKPLOY_URL="${DOKPLOY_URL:-http://localhost:3000/api}"
PROJECT_NAME=""
ENVIRONMENT_NAME=""
APP_NAME=""
GIT_URL=""
BRANCH=""
BUILD_PATH="/"
DOCKERFILE=""
DOCKER_CONTEXT="."
DOCKER_BUILD_STAGE=""
ENV_FILE=""
DOMAIN_HOST=""
TARGET_PORT=""
declare -a WATCH_PATHS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --environment)
      ENVIRONMENT_NAME="$2"
      shift 2
      ;;
    --name)
      APP_NAME="$2"
      shift 2
      ;;
    --git-url)
      GIT_URL="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --build-path)
      BUILD_PATH="$2"
      shift 2
      ;;
    --dockerfile)
      DOCKERFILE="$2"
      shift 2
      ;;
    --context)
      DOCKER_CONTEXT="$2"
      shift 2
      ;;
    --build-stage)
      DOCKER_BUILD_STAGE="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --domain)
      DOMAIN_HOST="$2"
      shift 2
      ;;
    --port)
      TARGET_PORT="$2"
      shift 2
      ;;
    --watch)
      WATCH_PATHS+=("$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_NAME" || -z "$ENVIRONMENT_NAME" || -z "$APP_NAME" || -z "$GIT_URL" || -z "$BRANCH" || -z "$DOCKERFILE" || -z "$ENV_FILE" ]]; then
  usage
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ -n "$DOMAIN_HOST" && -z "$TARGET_PORT" ]]; then
  echo "--port is required when --domain is provided." >&2
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local response_file
  local status

  response_file="$(mktemp)"

  if [[ -n "$data" ]]; then
    status="$(
      curl -sS -o "$response_file" -w "%{http_code}" -X "$method" \
        "$DOKPLOY_URL/$path" \
        -H "x-api-key: $DOKPLOY_TOKEN" \
        -H "Authorization: $DOKPLOY_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data"
    )"
  else
    status="$(
      curl -sS -o "$response_file" -w "%{http_code}" -X "$method" \
        "$DOKPLOY_URL/$path" \
        -H "x-api-key: $DOKPLOY_TOKEN" \
        -H "Authorization: $DOKPLOY_TOKEN"
    )"
  fi

  if [[ ! "$status" =~ ^2 ]]; then
    echo "Dokploy API error: $method $path -> HTTP $status" >&2
    cat "$response_file" >&2
    rm -f "$response_file"
    return 1
  fi

  cat "$response_file"
  rm -f "$response_file"
}

find_project_id() {
  api GET "project.all" | jq -r --arg name "$PROJECT_NAME" '.[] | select(.name == $name) | .projectId' | head -n1
}

find_environment_id() {
  local project_id="$1"
  api GET "environment.byProjectId?projectId=$project_id" | jq -r --arg name "$ENVIRONMENT_NAME" '.[] | select(.name == $name) | .environmentId' | head -n1
}

find_application_id() {
  local project_id="$1"
  api GET "project.one?projectId=$project_id" | jq -r --arg name "$APP_NAME" '
    .. | objects | select((.name? // "") == $name and .applicationId?) | .applicationId
  ' | head -n1
}

create_application() {
  local environment_id="$1"
  api POST "application.create" "$(jq -nc --arg name "$APP_NAME" --arg environmentId "$environment_id" '{name:$name, environmentId:$environmentId}')"
}

save_git_provider() {
  local application_id="$1"
  local watch_paths_json
  watch_paths_json="$(printf '%s\n' "${WATCH_PATHS[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')"

  api POST "application.saveGitProvider" "$(
    jq -nc \
      --arg applicationId "$application_id" \
      --arg customGitBranch "$BRANCH" \
      --arg customGitBuildPath "$BUILD_PATH" \
      --arg customGitUrl "$GIT_URL" \
      --argjson watchPaths "$watch_paths_json" \
      '{
        applicationId: $applicationId,
        customGitBranch: $customGitBranch,
        customGitBuildPath: $customGitBuildPath,
        customGitUrl: $customGitUrl,
        watchPaths: $watchPaths,
        enableSubmodules: false
      }'
  )" >/dev/null
}

save_build_type() {
  local application_id="$1"
  api POST "application.saveBuildType" "$(
    jq -nc \
      --arg applicationId "$application_id" \
      --arg dockerfile "$DOCKERFILE" \
      --arg dockerContextPath "$DOCKER_CONTEXT" \
      --arg dockerBuildStage "$DOCKER_BUILD_STAGE" \
      '{
        applicationId: $applicationId,
        buildType: "dockerfile",
        dockerfile: $dockerfile,
        dockerContextPath: $dockerContextPath,
        dockerBuildStage: ($dockerBuildStage | if . == "" then null else . end),
        herokuVersion: null,
        railpackVersion: null,
        publishDirectory: null,
        isStaticSpa: null
      }'
  )" >/dev/null
}

save_environment() {
  local application_id="$1"
  local env_content
  local build_args

  env_content="$(cat "$ENV_FILE")"
  build_args="$(grep '^NEXT_PUBLIC_' "$ENV_FILE" || true)"

  api POST "application.saveEnvironment" "$(
    jq -nc \
      --arg applicationId "$application_id" \
      --arg env "$env_content" \
      --arg buildArgs "$build_args" \
      '{
        applicationId: $applicationId,
        env: $env,
        buildArgs: $buildArgs,
        buildSecrets: "",
        createEnvFile: true
      }'
  )" >/dev/null
}

ensure_domain() {
  local application_id="$1"
  local existing_domain_id

  [[ -z "$DOMAIN_HOST" ]] && return 0

  existing_domain_id="$(
    api GET "domain.byApplicationId?applicationId=$application_id" | jq -r --arg host "$DOMAIN_HOST" '
      .. | objects | select((.host? // "") == $host and .domainId?) | .domainId
    ' | head -n1
  )"

  if [[ -n "$existing_domain_id" ]]; then
    return 0
  fi

  api POST "domain.create" "$(
    jq -nc \
      --arg host "$DOMAIN_HOST" \
      --arg applicationId "$application_id" \
      --argjson port "$TARGET_PORT" \
      '{
        host: $host,
        path: "/",
        port: $port,
        https: true,
        applicationId: $applicationId,
        certificateType: "letsencrypt",
        domainType: "application"
      }'
  )" >/dev/null
}

deploy_application() {
  local application_id="$1"
  api POST "application.deploy" "$(jq -nc --arg applicationId "$application_id" '{applicationId:$applicationId}')" >/dev/null
}

PROJECT_ID="$(find_project_id)"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Project not found: $PROJECT_NAME" >&2
  exit 1
fi

ENVIRONMENT_ID="$(find_environment_id "$PROJECT_ID")"
if [[ -z "$ENVIRONMENT_ID" ]]; then
  echo "Environment not found: $PROJECT_NAME / $ENVIRONMENT_NAME" >&2
  exit 1
fi

APPLICATION_ID="$(find_application_id "$PROJECT_ID")"
if [[ -z "$APPLICATION_ID" ]]; then
  create_response="$(create_application "$ENVIRONMENT_ID")"
  APPLICATION_ID="$(printf '%s' "$create_response" | jq -r '.applicationId // .id // .data?.applicationId // .data?.id // empty' | head -n1)"
fi

if [[ -z "$APPLICATION_ID" ]]; then
  APPLICATION_ID="$(find_application_id "$PROJECT_ID")"
fi

if [[ -z "$APPLICATION_ID" ]]; then
  echo "Could not create or locate application: $APP_NAME" >&2
  exit 1
fi

save_git_provider "$APPLICATION_ID"
save_build_type "$APPLICATION_ID"
save_environment "$APPLICATION_ID"
ensure_domain "$APPLICATION_ID"
deploy_application "$APPLICATION_ID"

echo "Dokploy application synced:"
echo "  name: $APP_NAME"
echo "  applicationId: $APPLICATION_ID"
