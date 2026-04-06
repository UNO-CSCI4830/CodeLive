# Local Dev (Simple)

Use this when you want the full app running on your machine.

## 1. One-time setup

```bash
git clone <your-repo-url>
cd CodeLive
./scripts/setup.sh
infisical login
```

`./scripts/setup.sh` checks tools and runs all required installs (`npm install` in root, backend, and frontend).

## 2. Start project (backend + frontend, fully local)

```bash
./scripts/dev-local.sh
```

That starts:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## 3. Stop project

Press `Ctrl + C` in the terminal running `./scripts/dev-local.sh`.

---

## Optional: frontend local + production backend

```bash
./scripts/dev.sh
```

This runs frontend locally and points API/WebSocket traffic at Fly production backend.

---

## If you do not want to use setup.sh

Run installs manually:

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```
