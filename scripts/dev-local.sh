#!/usr/bin/env bash
# scripts/dev-local.sh — Run the full app locally via Docker Compose.
# Secrets are injected by Infisical; Docker handles all dependencies.
set -euo pipefail

if ! command -v docker &>/dev/null; then
  echo "✘ Docker not found. Install Docker Desktop: https://docs.docker.com/get-started/get-docker/"
  exit 1
fi

if ! command -v infisical &>/dev/null; then
  echo "✘ Infisical CLI not found. See local-dev.md for install instructions."
  exit 1
fi

echo ""
echo "Starting CodeLive (full local)..."
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:5000"
echo ""

exec infisical run --env=dev --path=/Backend -- \
  infisical run --env=dev --path=/Frontend -- \
  docker compose up
