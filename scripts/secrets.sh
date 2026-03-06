#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/secrets.sh — Manage Fly.io production secrets
#
# Usage:
#   ./scripts/secrets.sh list     — Show current Fly secrets
#   ./scripts/secrets.sh set      — Interactively set secrets
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

# Read app name from fly.toml
if [[ -f "$BACKEND_DIR/fly.toml" ]]; then
  APP_NAME=$(grep "^app" "$BACKEND_DIR/fly.toml" | head -1 | sed "s/.*= *['\"]//;s/['\"]//")
else
  echo -e "${RED}✘ No fly.toml found in backend/${NC}"
  exit 1
fi

# Ensure Fly CLI is available and authed
check_fly() {
  if ! command -v fly &>/dev/null; then
    echo -e "${RED}✘ Fly CLI not found.${NC} Install: curl -L https://fly.io/install.sh | sh"
    exit 1
  fi
  if ! fly auth whoami &>/dev/null 2>&1; then
    echo -e "${RED}✘ Not logged in to Fly.${NC} Run: fly auth login"
    exit 1
  fi
}

# ── list ──────────────────────────────────────────────────
cmd_list() {
  check_fly
  echo ""
  echo -e "${CYAN}Secrets for ${APP_NAME}:${NC}"
  echo ""
  fly secrets list --app "$APP_NAME"
  echo ""
}

# ── set ───────────────────────────────────────────────────
cmd_set() {
  check_fly
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  Set Fly.io Secrets for: $APP_NAME"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo "Enter each value (leave blank to skip):"
  echo ""

  SECRETS=()

  read -rp "  SUPABASE_URL: " VAL
  [[ -n "$VAL" ]] && SECRETS+=("SUPABASE_URL=$VAL")

  read -rp "  SUPABASE_ANON_KEY: " VAL
  [[ -n "$VAL" ]] && SECRETS+=("SUPABASE_ANON_KEY=$VAL")

  read -rp "  SUPABASE_SERVICE_ROLE_KEY: " VAL
  [[ -n "$VAL" ]] && SECRETS+=("SUPABASE_SERVICE_ROLE_KEY=$VAL")

  read -rp "  ANTHROPIC_API_KEY: " VAL
  [[ -n "$VAL" ]] && SECRETS+=("ANTHROPIC_API_KEY=$VAL")

  read -rp "  CORS_ORIGINS [http://localhost:3000]: " VAL
  VAL="${VAL:-http://localhost:3000}"
  SECRETS+=("CORS_ORIGINS=$VAL")

  if [[ ${#SECRETS[@]} -eq 0 ]]; then
    echo ""
    echo "  No secrets entered. Nothing to do."
    exit 0
  fi

  echo ""
  echo -e "${CYAN}Setting ${#SECRETS[@]} secret(s) on $APP_NAME...${NC}"
  fly secrets set --app "$APP_NAME" "${SECRETS[@]}"

  echo ""
  echo -e "${GREEN}✔ Secrets updated.${NC}"
  echo ""
}

# ── rotate ────────────────────────────────────────────────
cmd_rotate() {
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  Key Rotation Checklist"
  echo "══════════════════════════════════════════════════"
  echo ""
  echo -e "  ${YELLOW}1.${NC} Supabase"
  echo "     → Dashboard → Project Settings → API"
  echo "     → Regenerate anon key and service role key"
  echo ""
  echo -e "  ${YELLOW}2.${NC} Anthropic"
  echo "     → console.anthropic.com → API Keys"
  echo "     → Create a new key, then revoke the old one"
  echo ""
  echo -e "  ${YELLOW}3.${NC} Update Fly.io"
  echo "     → Run: ./scripts/secrets.sh set"
  echo ""
  echo -e "  ${YELLOW}4.${NC} Update Infisical"
  echo "     → app.infisical.com → CodeLive project → Dev environment"
  echo "     → Update the same keys with new values"
  echo ""
  echo -e "  ${YELLOW}5.${NC} Verify"
  echo "     → ./scripts/deploy.sh   (redeploy backend)"
  echo "     → ./scripts/dev.sh      (test locally)"
  echo ""
}

# ── usage ─────────────────────────────────────────────────
usage() {
  echo ""
  echo "Usage: ./scripts/secrets.sh <command>"
  echo ""
  echo "Commands:"
  echo "  list      Show current Fly.io secrets"
  echo "  set       Interactively set all production secrets"
  echo "  rotate    Show key rotation checklist"
  echo ""
}

# ── main ──────────────────────────────────────────────────
case "${1:-}" in
  list)   cmd_list   ;;
  set)    cmd_set    ;;
  rotate) cmd_rotate ;;
  *)      usage      ;;
esac
