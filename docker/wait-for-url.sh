#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: wait-for-url.sh <label> <env-var-name> <default-port>" >&2
  exit 1
fi

label="$1"
env_var_name="$2"
default_port="$3"

resolved="$(node -e '
const envVarName = process.argv[1];
const defaultPort = process.argv[2];
const value = process.env[envVarName];

if (!value) {
  console.error(`Missing required environment variable: ${envVarName}`);
  process.exit(1);
}

try {
  const url = new URL(value);
  process.stdout.write(`${url.hostname} ${url.port || defaultPort}`);
} catch (error) {
  console.error(`Invalid URL in ${envVarName}: ${value}`);
  process.exit(1);
}
' "$env_var_name" "$default_port")"

host="$(printf '%s' "$resolved" | awk '{print $1}')"
port="$(printf '%s' "$resolved" | awk '{print $2}')"

until nc -z "$host" "$port"; do
  echo "[$label] waiting for $env_var_name ($host:$port)..."
  sleep 1
done
