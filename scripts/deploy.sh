#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/deploy.sh — Deploy backend to Fly.io
# Runs pre-deploy checks then deploys.
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✘${NC} $1"; exit 1; }

echo ""
echo "══════════════════════════════════════════════════"
echo "  CodeLive — Deploy Backend to Fly.io"
echo "══════════════════════════════════════════════════"
echo ""

# ── Preflight checks ─────────────────────────────────────
echo "Running pre-deploy checks..."

# Fly CLI
if ! command -v fly &>/dev/null; then
  fail "Fly CLI not found. Install: curl -L https://fly.io/install.sh | sh"
fi
ok "Fly CLI installed"

# Fly auth
if ! fly auth whoami &>/dev/null 2>&1; then
  fail "Not logged in to Fly. Run: fly auth login"
fi
ok "Authenticated as $(fly auth whoami 2>/dev/null)"

# Dockerfile exists
if [[ ! -f "$BACKEND_DIR/Dockerfile" ]]; then
  fail "No Dockerfile found in backend/"
fi
ok "Dockerfile found"

# fly.toml exists
if [[ ! -f "$BACKEND_DIR/fly.toml" ]]; then
  fail "No fly.toml found in backend/"
fi

APP_NAME=$(grep "^app" "$BACKEND_DIR/fly.toml" | head -1 | sed "s/.*= *['\"]//;s/['\"]//")
ok "fly.toml found (app: $APP_NAME)"

# TypeScript build check
echo ""
echo "Testing TypeScript build..."
cd "$BACKEND_DIR"
if npx tsc --noEmit 2>&1; then
  ok "TypeScript compiles cleanly"
else
  fail "TypeScript errors found — fix them before deploying"
fi

# Check Fly secrets are set
echo ""
echo "Checking Fly secrets..."
SECRET_COUNT=$(fly secrets list --app "$APP_NAME" 2>/dev/null | tail -n +2 | wc -l)
if [[ "$SECRET_COUNT" -lt 3 ]]; then
  warn "Only $SECRET_COUNT secrets set on Fly. Expected at least 3 (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)"
  echo "    Run: ./scripts/secrets.sh set"
  echo ""
  read -rp "  Continue anyway? (y/N) " CONTINUE
  if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    echo "  Aborted."
    exit 1
  fi
else
  ok "$SECRET_COUNT secrets configured"
fi

# ── Deploy ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Deploying to Fly.io...${NC}"
echo ""

cd "$BACKEND_DIR"
fly deploy

echo ""
echo "══════════════════════════════════════════════════"
echo -e "  ${GREEN}Deploy complete!${NC}"
echo ""
echo "  App URL:  https://$APP_NAME.fly.dev"
echo "  Status:   fly status --app $APP_NAME"
echo "  Logs:     fly logs --app $APP_NAME"
echo "  Health:   curl https://$APP_NAME.fly.dev/api/health"
echo "══════════════════════════════════════════════════"
echo ""
