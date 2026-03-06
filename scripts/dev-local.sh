#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/dev-local.sh — Start fully local development
# Runs backend + frontend in parallel with Infisical secrets.
# Ctrl+C stops both.
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Preflight checks ─────────────────────────────────────
if ! command -v infisical &>/dev/null; then
  echo -e "${RED}✘ Infisical CLI not found.${NC} Run ./scripts/setup.sh first."
  exit 1
fi

echo ""
echo -e "${CYAN}Starting CodeLive development servers...${NC}"
echo ""

# ── Trap Ctrl+C to kill both processes ────────────────────
cleanup() {
  echo ""
  echo -e "${CYAN}Shutting down...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}✔ Stopped.${NC}"
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────
echo -e "  ${GREEN}▶${NC} Backend  → http://localhost:5000"
cd "$ROOT_DIR/backend" && npm run dev &
BACKEND_PID=$!

# ── Start frontend ────────────────────────────────────────
echo -e "  ${GREEN}▶${NC} Frontend → http://localhost:3000"
cd "$ROOT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}Both servers running. Press Ctrl+C to stop.${NC}"
echo ""

# ── Wait for either to exit ──────────────────────────────
wait
