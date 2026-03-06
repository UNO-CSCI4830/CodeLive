#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# scripts/setup.sh — First-time project setup
# Installs dependencies and verifies required tooling.
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✘${NC} $1"; }

echo ""
echo "══════════════════════════════════════════════════"
echo "  CodeLive — Project Setup"
echo "══════════════════════════════════════════════════"
echo ""

# ── Check required tools ─────────────────────────────────
echo "Checking tools..."

MISSING=0

if command -v node &>/dev/null; then
  ok "Node.js $(node --version)"
else
  fail "Node.js not found — install from https://nodejs.org"
  MISSING=1
fi

if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm not found"
  MISSING=1
fi

if command -v python3 &>/dev/null; then
  ok "Python $(python3 --version 2>&1 | awk '{print $2}')"
else
  warn "Python 3 not found — code execution (/api/run/python) won't work"
fi

if command -v infisical &>/dev/null; then
  ok "Infisical CLI $(infisical --version 2>&1 | awk '{print $NF}')"
else
  fail "Infisical CLI not found"
  echo ""
  echo "    Install it:"
  echo "      Ubuntu/Debian:  curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash && sudo apt-get install infisical"
  echo "      macOS:          brew install infisical/get-cli/infisical"
  echo "      Windows:        scoop bucket add infisical https://github.com/Infisical/scoop-infisical.git && scoop install infisical"
  echo ""
  MISSING=1
fi

if command -v fly &>/dev/null; then
  ok "Fly CLI $(fly version 2>&1 | head -1)"
else
  warn "Fly CLI not found — only needed for deployment"
  echo "    Install: curl -L https://fly.io/install.sh | sh"
fi

if [[ $MISSING -eq 1 ]]; then
  echo ""
  fail "Missing required tools. Install them and re-run this script."
  exit 1
fi

# ── Check Infisical login ────────────────────────────────
echo ""
echo "Checking Infisical auth..."

if infisical secrets --silent &>/dev/null 2>&1; then
  ok "Logged in to Infisical"
else
  warn "Not logged in to Infisical"
  echo "    Run: infisical login"
  echo "    If you don't have an account, ask the project owner to invite you."
fi

# ── Install dependencies ─────────────────────────────────
echo ""
echo "Installing dependencies..."

echo "  → root"
cd "$ROOT_DIR" && npm install --silent

echo "  → backend"
cd "$ROOT_DIR/backend" && npm install --silent

echo "  → frontend"
cd "$ROOT_DIR/frontend" && npm install --silent

ok "All dependencies installed"

# ── Make scripts executable ──────────────────────────────
chmod +x "$ROOT_DIR"/scripts/*.sh
ok "Scripts are executable"

# ── Done ─────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo -e "  ${GREEN}Setup complete!${NC}"
echo ""
echo "  Next steps:"
echo "    1. infisical login              (if not already)"
echo "    2. ./scripts/dev.sh             (frontend + Fly backend)"
echo "       ./scripts/dev-local.sh       (fully local)"
echo "══════════════════════════════════════════════════"
echo ""
