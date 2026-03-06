#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/dev.sh — Start frontend with Fly.io backend
# Runs only the frontend locally, proxying API + WebSocket
# requests to the deployed Fly.io backend.
# Use this for cross-machine sessions with teammates.
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLY_URL="https://codelive-backend.fly.dev"

# ── Preflight checks ─────────────────────────────────────
if ! command -v infisical &>/dev/null; then
  echo -e "${RED}✘ Infisical CLI not found.${NC} Run ./scripts/setup.sh first."
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  CodeLive — Remote Backend Mode"
echo "══════════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}▶${NC} Frontend → http://localhost:3000"
echo -e "  ${CYAN}☁${NC} Backend  → $FLY_URL"
echo ""

# ── Check Fly backend is reachable ────────────────────────
echo -n "  Checking Fly backend... "
if curl -sf "$FLY_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✔ Online${NC}"
else
  echo -e "${YELLOW}⚠ Not responding (machine may be waking up — give it a few seconds)${NC}"
fi

echo ""

# ── Start frontend with Fly backend URL ───────────────────
cd "$ROOT_DIR/frontend"
VITE_BACKEND_URL="$FLY_URL" npm run dev
