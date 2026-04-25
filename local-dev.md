# Local Dev

## 1. One-time setup

Install two tools:

**Docker Desktop** — manages all project dependencies automatically
https://docs.docker.com/get-started/get-docker/

**Infisical CLI** — injects secrets at runtime (no `.env` files needed)

```bash
# Ubuntu / Debian
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash
sudo apt-get install infisical

# macOS
brew install infisical/get-cli/infisical

# Windows (Scoop)
scoop bucket add infisical https://github.com/Infisical/scoop-infisical.git
scoop install infisical
```

Then log in to Infisical (ask the project owner to invite you first):

```bash
infisical login
```

That's it. No `npm install`, no Python setup — Docker handles everything.

> The repo already contains `.infisical.json` linking to the project. You only need to log in — no `infisical init` required.

---

## 2. Run the full app (backend + frontend)

```bash
./scripts/dev-local.sh
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Press `Ctrl+C` to stop.

> **First run only:** Docker builds the images (~1–2 minutes). Every run after that is instant.

---

## 3. Run frontend against the production backend

Use this when you want to develop UI without running the backend locally.

```bash
./scripts/dev.sh
```

- Frontend: http://localhost:3000
- Backend: https://codelive-backend.fly.dev

---

## After a `git pull`

If `package.json` or a `Dockerfile.dev` changed, rebuild the images:

```bash
docker compose build
```

Then run as normal. If you see "module not found" errors after a rebuild, the node_modules volume is stale — reset it:

```bash
docker compose down -v
./scripts/dev-local.sh
```
