#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/deploy.sh — Deploy split backend services to Fly.io
# - runner app first
# - backend api app second
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

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✘${NC} $1"; exit 1; }

extract_app_name() {
  local file="$1"
  grep "^app" "$file" | head -1 | sed "s/.*= *['\"]//;s/['\"]//"
}

has_secret() {
  local app_name="$1"
  local secret_name="$2"
  "$FLY_BIN" secrets list --app "$app_name" 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "$secret_name"
}

has_machines() {
  local app_name="$1"
  local count
  count="$("$FLY_BIN" machine list --app "$app_name" --json 2>/dev/null | node -e 'const fs=require("fs");const raw=fs.readFileSync(0,"utf8");let arr=[];try{arr=JSON.parse(raw)}catch{};process.stdout.write(String(Array.isArray(arr)?arr.length:0));')"
  [[ "${count:-0}" -gt 0 ]]
}

resolve_fly_bin() {
  if [[ -d "$HOME/.fly/bin" ]]; then
    export PATH="$HOME/.fly/bin:$PATH"
  fi
  if command -v fly >/dev/null 2>&1; then
    FLY_BIN="fly"
    return
  fi
  if command -v flyctl >/dev/null 2>&1; then
    FLY_BIN="flyctl"
    return
  fi
  fail "Fly CLI not found. Install: curl -L https://fly.io/install.sh | sh"
}

echo ""
echo "══════════════════════════════════════════════════"
echo "  CodeLive — Deploy Split Backend to Fly.io"
echo "══════════════════════════════════════════════════"
echo ""

[[ -f "$API_FLY_TOML" ]] || fail "Missing $API_FLY_TOML"
[[ -f "$RUNNER_FLY_TOML" ]] || fail "Missing $RUNNER_FLY_TOML"

API_APP="$(extract_app_name "$API_FLY_TOML")"
RUNNER_APP="$(extract_app_name "$RUNNER_FLY_TOML")"

[[ -n "$API_APP" ]] || fail "Could not read API app name from fly.toml"
[[ -n "$RUNNER_APP" ]] || fail "Could not read runner app name from fly.runner.toml"

echo "Running pre-deploy checks..."

resolve_fly_bin
ok "Fly CLI installed (${FLY_BIN})"

command -v docker >/dev/null 2>&1 || fail "Docker not found (required for Fly Docker builds)."
ok "Docker installed"

if ! "$FLY_BIN" auth whoami >/dev/null 2>&1; then
  fail "Not logged in to Fly. Run: fly auth login"
fi
ok "Authenticated as $("$FLY_BIN" auth whoami 2>/dev/null)"
ok "API app: $API_APP"
ok "Runner app: $RUNNER_APP"

echo ""
echo "Testing TypeScript build..."
cd "$BACKEND_DIR"
npx tsc --noEmit >/dev/null
ok "TypeScript compiles cleanly"

echo ""
echo "Checking required secrets..."

MISSING=0

for name in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY RUNNER_SHARED_TOKEN; do
  if has_secret "$API_APP" "$name"; then
    ok "$API_APP has $name"
  else
    warn "$API_APP missing $name"
    MISSING=1
  fi
done

if has_secret "$RUNNER_APP" "RUNNER_SHARED_TOKEN"; then
  ok "$RUNNER_APP has RUNNER_SHARED_TOKEN"
else
  if has_machines "$RUNNER_APP"; then
    warn "$RUNNER_APP missing RUNNER_SHARED_TOKEN"
    MISSING=1
  else
    warn "$RUNNER_APP has no machines yet; assuming secret is staged for first deploy."
  fi
fi

if [[ "$MISSING" -eq 1 ]]; then
  echo ""
  fail "Missing required secrets. Run: ./scripts/secrets.sh set"
fi

echo ""
echo -e "${CYAN}Deploying runner first (${RUNNER_APP})...${NC}"
cd "$ROOT_DIR"
"$FLY_BIN" deploy --config backend/fly.runner.toml .

echo ""
echo -e "${CYAN}Deploying API second (${API_APP})...${NC}"
"$FLY_BIN" deploy --config backend/fly.toml .

echo ""
echo -e "${CYAN}Verifying API health...${NC}"
if curl -fsS "https://${API_APP}.fly.dev/health" >/dev/null; then
  ok "API health check passed: https://${API_APP}.fly.dev/health"
else
  warn "API health endpoint did not return success yet. Check logs:"
  echo "  fly logs --app $API_APP"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo -e "  ${GREEN}Deploy complete!${NC}"
echo ""
echo "  API URL:     https://${API_APP}.fly.dev"
echo "  API Health:  https://${API_APP}.fly.dev/health"
echo "  API Logs:    fly logs --app $API_APP"
echo "  Runner Logs: fly logs --app $RUNNER_APP"
echo "══════════════════════════════════════════════════"
echo ""
