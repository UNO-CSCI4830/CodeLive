#!/usr/bin/env bash
# scripts/dev.sh — Run the frontend locally against the production Fly.io backend.
# Use this when you want to develop UI without running the backend locally.
set -euo pipefail

FLY_URL="https://codelive-backend.fly.dev"

if ! command -v docker &>/dev/null; then
  echo "✘ Docker not found. Install Docker Desktop: https://docs.docker.com/get-started/get-docker/"
  exit 1
fi

if ! command -v infisical &>/dev/null; then
  echo "✘ Infisical CLI not found. See local-dev.md for install instructions."
  exit 1
fi

echo ""
echo "Starting CodeLive (frontend → Fly backend)..."
echo "  Frontend → http://localhost:3000"
echo "  Backend  → $FLY_URL"
echo ""

exec VITE_BACKEND_URL="$FLY_URL" infisical run --env=dev --path=/Frontend -- \
  docker compose up frontend
