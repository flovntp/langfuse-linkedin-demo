#!/usr/bin/env bash
# Runs a local, self-hosted Langfuse with the official docker compose file.
#   ./scripts/langfuse.sh up      download compose file, generate secrets, start
#   ./scripts/langfuse.sh down    stop (data is kept in docker volumes)
#   ./scripts/langfuse.sh reset   stop and delete all data
#   ./scripts/langfuse.sh logs    follow the web container logs
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=.langfuse
COMPOSE_URL=https://raw.githubusercontent.com/langfuse/langfuse/main/docker-compose.yml
compose() { docker compose -p langfuse-demo -f "$DIR/docker-compose.yml" -f langfuse/docker-compose.override.yml --env-file "$DIR/secrets.env" "$@"; }

# Read a value from the app's .env (the demo keys and the UI login live there).
env_value() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }

prepare() {
  [ -f .env ] || { echo "Missing .env: run 'cp .env.example .env' first."; exit 1; }
  mkdir -p "$DIR"
  [ -f "$DIR/docker-compose.yml" ] || curl -fsSL "$COMPOSE_URL" -o "$DIR/docker-compose.yml"

  # Secrets for the Langfuse stack: generated once, never committed.
  if [ ! -f "$DIR/secrets.env" ]; then
    cat > "$DIR/secrets.env" <<SECRETS
NEXTAUTH_SECRET=$(openssl rand -hex 32)
SALT=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
TELEMETRY_ENABLED=false
SECRETS
  fi

  # Headless initialization: org, project, API keys and a user, no clicks needed.
  local tmp; tmp=$(grep -v '^LANGFUSE_INIT_' "$DIR/secrets.env")
  cat > "$DIR/secrets.env" <<SECRETS
$tmp
LANGFUSE_INIT_ORG_ID=demo-org
LANGFUSE_INIT_ORG_NAME=Langfuse Demo
LANGFUSE_INIT_PROJECT_ID=linkedin-demo
LANGFUSE_INIT_PROJECT_NAME=Blog to LinkedIn
LANGFUSE_INIT_PROJECT_PUBLIC_KEY=$(env_value LANGFUSE_PUBLIC_KEY)
LANGFUSE_INIT_PROJECT_SECRET_KEY=$(env_value LANGFUSE_SECRET_KEY)
LANGFUSE_INIT_USER_EMAIL=$(env_value LANGFUSE_INIT_USER_EMAIL)
LANGFUSE_INIT_USER_NAME=Demo
LANGFUSE_INIT_USER_PASSWORD=$(env_value LANGFUSE_INIT_USER_PASSWORD)
SECRETS
}

case "${1:-up}" in
  up)
    prepare
    compose up -d
    printf "Waiting for Langfuse on http://localhost:3000 "
    until curl -fs http://localhost:3000/api/public/health >/dev/null 2>&1; do printf "."; sleep 3; done
    echo " ready."
    echo "Log in with $(env_value LANGFUSE_INIT_USER_EMAIL) / the password in .env"
    ;;
  down)  compose down ;;
  reset) compose down -v && rm -rf "$DIR" ;;
  logs)  compose logs -f langfuse-web ;;
  *) echo "Usage: $0 up|down|reset|logs"; exit 1 ;;
esac
