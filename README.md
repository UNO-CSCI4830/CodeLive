# Code Live

**Live technical interviews that reflect real engineering work.**

Code Live modernises technical interviews to match how engineers actually work — with collaboration, documentation, and AI-assisted reasoning. Instead of contrived algorithm puzzles, Code Live provides a live interview environment where interviewers observe a candidate's real workflow and thinking in real time.

This monorepo contains the **frontend** (React / Vite / TypeScript) and **backend** (Express / TypeScript) for the platform.

---

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| **Docker Desktop** | ✅ | [docs.docker.com/get-started/get-docker](https://docs.docker.com/get-started/get-docker/) |
| **Infisical CLI** | ✅ | See [local-dev.md](local-dev.md) |
| **Fly CLI** | Deploy only | `curl -L https://fly.io/install.sh \| sh` |

---

## Getting Started (New Team Member)

```bash
# 1. Clone the repo
git clone <repo-url> && cd CodeLive

# 2. Log in to Infisical (one-time — ask project owner for an invite)
infisical login

# 3. Start developing (Docker handles all dependencies automatically)
./scripts/dev-local.sh
```

No `npm install`, no Python setup. Docker builds everything on first run (~1–2 min), then it's instant. See [local-dev.md](local-dev.md) for full setup instructions.

---

## Scripts

| Script | Description |
|--------|-------------|
| `./scripts/dev-local.sh` | Start backend (`:5000`) + frontend (`:3000`) locally via Docker |
| `./scripts/dev.sh` | Start frontend locally pointing at the Fly.io production backend |
| `./scripts/deploy.sh` | Deploy backend to Fly.io |
| `./scripts/secrets.sh list` | List current production secrets on Fly.io |
| `./scripts/secrets.sh set` | Interactively set all Fly.io production secrets |
| `./scripts/secrets.sh rotate` | Show key rotation checklist |

---

## Architecture

```
CodeLive/
├── frontend/          React 19 + Vite + Tailwind CSS
│   ├── src/
│   └── Dockerfile.dev Dev container
├── backend/           Express + TypeScript + Yjs WebSocket
│   ├── src/
│   ├── Dockerfile     Production container
│   ├── Dockerfile.dev Dev container
│   └── fly.toml       Fly.io config
├── content/           Question bank (JSON + seed scripts)
├── docker-compose.yml Local dev orchestration
├── scripts/           Dev & deploy scripts
├── local-dev.md       Local dev setup guide
├── prod-dev.md        Fly.io deploy guide
├── SECRETS.md         Secret management docs
└── README.md          ← you are here
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS, Monaco Editor |
| **Backend** | Express, TypeScript, Yjs + WebSocket (collaborative editing) |
| **Database** | Supabase (PostgreSQL + Auth + Realtime) |
| **AI** | Anthropic Claude (chat assistant + report generation) |
| **Hosting** | Fly.io (backend) |
| **Secrets** | Infisical (local dev) · Fly.io secrets (production) |

---

## Secret Management

Secrets are **never committed** to the repo. Two systems are used:

| Environment | Secrets Source | How |
|-------------|---------------|-----|
| **Local dev** | Infisical | `npm run dev` calls `infisical run` automatically |
| **Production** | Fly.io | Set via `fly secrets set` or `./scripts/secrets.sh set` |

### Required Secrets

**Backend:**

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (bypasses RLS) |
| `ANTHROPIC_API_KEY` | ⚠️ | Anthropic key — AI features degrade gracefully without it |
| `CORS_ORIGINS` | ❌ | Comma-separated origins (defaults to `http://localhost:3000`) |
| `RUN_EXECUTION_MODE` | Production API ✅ | Use `proxy` in production API, `direct` only for the private runner/local dev |
| `RUNNER_BASE_URL` | Production API ✅ | Private runner URL, e.g. `http://codelive-runner.internal:5000` |
| `RUNNER_SHARED_TOKEN` | Production API + runner ✅ | Shared secret proving API-to-runner requests |

**Frontend:**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Same Supabase public anon key |

> Full docs: **[SECRETS.md](SECRETS.md)**

---

## Deployment

The backend is deployed to **[Fly.io](https://fly.io)** via Docker.

### First-time deploy

```bash
# 1. Log in to Fly
fly auth login

# 2. Create the app (from backend/)
cd backend && fly launch --no-deploy

# 3. Set production secrets
./scripts/secrets.sh set

# 4. Deploy
./scripts/deploy.sh
```

### Subsequent deploys

```bash
./scripts/deploy.sh
```

The deploy script runs pre-flight checks (Fly auth, TypeScript build, secrets count) before deploying.

### Production URLs

| Resource | URL |
|----------|-----|
| App | `https://codelive-backend.fly.dev` |
| Health | `https://codelive-backend.fly.dev/health` |
| Logs | `fly logs --app codelive-backend` |
| Status | `fly status --app codelive-backend` |

---

## Local Development

### Fully local (backend + frontend)

```bash
./scripts/dev-local.sh
```

Runs both servers via Docker:
- **Frontend** at `http://localhost:3000`
- **Backend** at `http://localhost:5000`

Press **Ctrl+C** to stop.

### Frontend only, against Fly.io backend

```bash
./scripts/dev.sh
```

Runs only the frontend locally. API and WebSocket requests proxy to the deployed Fly.io backend. Both you and a teammate can run this simultaneously and share the same backend for collaborative sessions.

See [local-dev.md](local-dev.md) for full setup instructions.

---

## Collaborative Sessions

Sessions use **two real-time systems**:

1. **Yjs + WebSocket** — Collaborative code editing (runs in the backend)
2. **Supabase Realtime** — Session state sync (question advances, locks, completion)

For local testing, open **two browser tabs** — one as interviewer, one as candidate. Both connect to your local backend's WebSocket server.

For cross-machine sessions, both users must connect to the **same backend** (either a deployed Fly.io instance, or via a tunnel like `ngrok http 5000`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `infisical: command not found` | See install instructions in [local-dev.md](local-dev.md) |
| `You must be logged in` | `infisical login` |
| `SUPABASE_URL is undefined` | Check secrets exist in Infisical Dev environment |
| Frontend env vars not loading | Must be prefixed with `VITE_` |
| Module not found after `git pull` | `docker compose build` then `./scripts/dev-local.sh` |
| node_modules errors persist | `docker compose down -v` then `./scripts/dev-local.sh` |
| Fly deploy fails | Check `fly auth whoami` and `fly status` |
| WebSocket not connecting | Ensure backend is running and Vite proxy is configured |
