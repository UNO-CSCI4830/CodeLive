#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/secrets.sh — Manage Fly.io production secrets
#
# Usage:
#   ./scripts/secrets.sh list     — Show current Fly secrets
#   ./scripts/secrets.sh set      — Interactively set secrets for split apps
#   ./scripts/secrets.sh set-from-infisical [env] [path]
#   ./scripts/secrets.sh rotate   — Key rotation checklist
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
API_FLY_TOML="$BACKEND_DIR/fly.toml"
RUNNER_FLY_TOML="$BACKEND_DIR/fly.runner.toml"
FLY_BIN=""
INFISICAL_BIN=""
INFISICAL_PROJECT_ID=""

extract_app_name() {
  local file="$1"
  grep "^app" "$file" | head -1 | sed "s/.*= *['\"]//;s/['\"]//"
}

if [[ ! -f "$API_FLY_TOML" ]]; then
  echo -e "${RED}✘ Missing backend/fly.toml${NC}"
  exit 1
fi
if [[ ! -f "$RUNNER_FLY_TOML" ]]; then
  echo -e "${RED}✘ Missing backend/fly.runner.toml${NC}"
  exit 1
fi

API_APP="$(extract_app_name "$API_FLY_TOML")"
RUNNER_APP="$(extract_app_name "$RUNNER_FLY_TOML")"

if [[ -z "$API_APP" || -z "$RUNNER_APP" ]]; then
  echo -e "${RED}✘ Could not parse app names from fly config files.${NC}"
  exit 1
fi

check_fly() {
  if [[ -d "$HOME/.fly/bin" ]]; then
    export PATH="$HOME/.fly/bin:$PATH"
  fi
  if command -v fly >/dev/null 2>&1; then
    FLY_BIN="fly"
  elif command -v flyctl >/dev/null 2>&1; then
    FLY_BIN="flyctl"
  else
    echo -e "${RED}✘ Fly CLI not found.${NC} Install: curl -L https://fly.io/install.sh | sh"
    exit 1
  fi
  if ! "$FLY_BIN" auth whoami >/dev/null 2>&1; then
    echo -e "${RED}✘ Not logged in to Fly.${NC} Run: fly auth login"
    exit 1
  fi
}

check_infisical() {
  if command -v infisical >/dev/null 2>&1; then
    INFISICAL_BIN="infisical"
  else
    echo -e "${RED}✘ Infisical CLI not found.${NC} Install it first (see SECRETS.md)."
    exit 1
  fi
  if [[ -f "$BACKEND_DIR/.infisical.json" ]]; then
    INFISICAL_PROJECT_ID="$(
      node -e "const fs=require('fs');const p='$BACKEND_DIR/.infisical.json';try{const j=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(j.workspaceId||'')}catch{}"
    )"
  fi
}

generate_token() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi
  if command -v node >/dev/null 2>&1; then
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    return
  fi
  echo ""
}

json_get_secret_value() {
  local json="$1"
  local key="$2"
  JSON_INPUT="$json" JSON_KEY="$key" node -e '
    const raw = process.env.JSON_INPUT || "[]";
    const key = process.env.JSON_KEY || "";
    let parsed = [];
    try { parsed = JSON.parse(raw); } catch { process.exit(0); }
    const row = parsed.find((item) => item && item.key === key);
    if (!row || row.value === undefined || row.value === null) process.exit(0);
    process.stdout.write(String(row.value));
  '
}

cmd_set_from_infisical() {
  check_fly
  check_infisical

  local infisical_env="${1:-${INFISICAL_ENV:-dev}}"
  local infisical_path="${2:-${INFISICAL_PATH:-/Backend}}"

  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  Sync Fly Secrets From Infisical"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo "Source:"
  echo "  env:  $infisical_env"
  echo "  path: $infisical_path"
  echo "Targets:"
  echo "  API:    $API_APP"
  echo "  Runner: $RUNNER_APP"
  echo ""

  local exported
  if ! exported="$(
    cd "$BACKEND_DIR"
    if [[ -n "$INFISICAL_PROJECT_ID" ]]; then
      "$INFISICAL_BIN" export --env="$infisical_env" --path="$infisical_path" --format=json --silent --projectId="$INFISICAL_PROJECT_ID"
    else
      "$INFISICAL_BIN" export --env="$infisical_env" --path="$infisical_path" --format=json --silent
    fi
  )"; then
    echo -e "${RED}✘ Failed to read Infisical secrets for env=${infisical_env} path=${infisical_path}.${NC}"
    echo "  Tip: if prod path is missing, try:"
    echo "  ./scripts/secrets.sh set-from-infisical dev /Backend"
    exit 1
  fi

  local RUNNER_TOKEN SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY CORS_ORIGINS
  RUNNER_TOKEN="$(json_get_secret_value "$exported" "RUNNER_SHARED_TOKEN")"
  SUPABASE_URL="$(json_get_secret_value "$exported" "SUPABASE_URL")"
  SUPABASE_ANON_KEY="$(json_get_secret_value "$exported" "SUPABASE_ANON_KEY")"
  SUPABASE_SERVICE_ROLE_KEY="$(json_get_secret_value "$exported" "SUPABASE_SERVICE_ROLE_KEY")"
  ANTHROPIC_API_KEY="$(json_get_secret_value "$exported" "ANTHROPIC_API_KEY")"
  CORS_ORIGINS="$(json_get_secret_value "$exported" "CORS_ORIGINS")"

  if [[ -z "$RUNNER_TOKEN" ]]; then
    RUNNER_TOKEN="$(generate_token)"
  fi
  if [[ -z "$CORS_ORIGINS" ]]; then
    CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
  fi

  if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo -e "${RED}✘ Missing required backend secrets in Infisical path ${infisical_path}.${NC}"
    echo "  Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
  fi

  echo -e "${CYAN}Setting runner secrets...${NC}"
  "$FLY_BIN" secrets set --app "$RUNNER_APP" "RUNNER_SHARED_TOKEN=$RUNNER_TOKEN"

  echo -e "${CYAN}Setting API secrets...${NC}"
  API_SECRETS=(
    "RUNNER_SHARED_TOKEN=$RUNNER_TOKEN"
    "SUPABASE_URL=$SUPABASE_URL"
    "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
    "CORS_ORIGINS=$CORS_ORIGINS"
  )
  if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    API_SECRETS+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
  fi
  "$FLY_BIN" secrets set --app "$API_APP" "${API_SECRETS[@]}"

  echo ""
  echo -e "${GREEN}✔ Synced secrets from Infisical to Fly for both apps.${NC}"
  echo ""
}

cmd_list() {
  check_fly
  echo ""
  echo -e "${CYAN}Secrets for API app (${API_APP}):${NC}"
  "$FLY_BIN" secrets list --app "$API_APP"
  echo ""
  echo -e "${CYAN}Secrets for Runner app (${RUNNER_APP}):${NC}"
  "$FLY_BIN" secrets list --app "$RUNNER_APP"
  echo ""
}

cmd_set() {
  check_fly
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  Set Fly.io Secrets (Split Backend)"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo "Apps:"
  echo "  API:    $API_APP"
  echo "  Runner: $RUNNER_APP"
  echo ""

  read -rp "  RUNNER_SHARED_TOKEN (leave blank to auto-generate): " RUNNER_TOKEN
  if [[ -z "$RUNNER_TOKEN" ]]; then
    RUNNER_TOKEN="$(generate_token)"
    if [[ -z "$RUNNER_TOKEN" ]]; then
      echo -e "${RED}✘ Could not auto-generate token (no openssl/node).${NC}"
      exit 1
    fi
    echo "  Generated RUNNER_SHARED_TOKEN."
  fi

  read -rp "  SUPABASE_URL: " SUPABASE_URL
  read -rp "  SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
  read -rp "  SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
  read -rp "  ANTHROPIC_API_KEY (optional): " ANTHROPIC_API_KEY
  read -rp "  CORS_ORIGINS [http://localhost:3000,http://127.0.0.1:3000]: " CORS_ORIGINS
  CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000}"

  if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo -e "${RED}✘ SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.${NC}"
    exit 1
  fi

  echo ""
  echo -e "${CYAN}Setting runner secrets...${NC}"
  "$FLY_BIN" secrets set --app "$RUNNER_APP" "RUNNER_SHARED_TOKEN=$RUNNER_TOKEN"

  echo -e "${CYAN}Setting API secrets...${NC}"
  API_SECRETS=(
    "RUNNER_SHARED_TOKEN=$RUNNER_TOKEN"
    "SUPABASE_URL=$SUPABASE_URL"
    "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
    "CORS_ORIGINS=$CORS_ORIGINS"
  )
  if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    API_SECRETS+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
  fi
  "$FLY_BIN" secrets set --app "$API_APP" "${API_SECRETS[@]}"

  echo ""
  echo -e "${GREEN}✔ Secrets updated for both apps.${NC}"
  echo ""
}

cmd_rotate() {
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  Split Backend Key Rotation Checklist"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo -e "  ${YELLOW}1.${NC} Regenerate RUNNER_SHARED_TOKEN"
  echo "     → Set new value on both apps via: ./scripts/secrets.sh set"
  echo ""
  echo -e "  ${YELLOW}2.${NC} Rotate Supabase keys"
  echo "     → Dashboard → Project Settings → API"
  echo "     → Update Fly API app secrets (SUPABASE_*)"
  echo ""
  echo -e "  ${YELLOW}3.${NC} Rotate Anthropic key (optional)"
  echo "     → console.anthropic.com → API Keys"
  echo ""
  echo -e "  ${YELLOW}4.${NC} Redeploy"
  echo "     → ./scripts/deploy.sh"
  echo ""
}

usage() {
  echo ""
  echo "Usage: ./scripts/secrets.sh <command>"
  echo ""
  echo "Commands:"
  echo "  list      Show current Fly.io secrets for API and runner apps"
  echo "  set       Interactively set all required production secrets"
  echo "  set-from-infisical [env] [path]"
  echo "            Sync required Fly secrets from Infisical (defaults: env=dev path=/Backend)"
  echo "  rotate    Show key rotation checklist"
  echo ""
}

case "${1:-}" in
  list)   cmd_list   ;;
  set)    cmd_set    ;;
  set-from-infisical) cmd_set_from_infisical "${2:-}" "${3:-}" ;;
  sync-infisical) cmd_set_from_infisical "${2:-}" "${3:-}" ;;
  rotate) cmd_rotate ;;
  *)      usage      ;;
esac
