# Code Live

**Live technical interviews that reflect real engineering work.**

Code Live modernises technical interviews to match how engineers actually work — with collaboration, documentation, and AI-assisted reasoning. Instead of contrived algorithm puzzles, Code Live provides a live interview environment where interviewers observe a candidate's real workflow and thinking in real time.

This monorepo contains the **frontend** (React / Vite / TypeScript) and **backend** (Express / TypeScript) for the platform.

---

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| **Node.js** ≥ 20 | ✅ | [nodejs.org](https://nodejs.org) |
| **npm** | ✅ | Comes with Node.js |
| **Python 3** | ✅ | `sudo apt install python3` / `brew install python3` |
| **Infisical CLI** | ✅ | See [SECRETS.md](SECRETS.md#1-install-the-infisical-cli) |
| **Fly CLI** | Deploy only | `curl -L https://fly.io/install.sh \| sh` |

---

## Getting Started (New Team Member)

```bash
# 1. Clone the repo
git clone <repo-url> && cd CodeLive

# 2. Log in to Infisical (one-time — ask project owner for an invite)
infisical login

# 3. Run setup (installs deps, verifies tools)
./scripts/setup.sh

# 4. Start developing
./scripts/dev.sh
```

That's it. Secrets are pulled from Infisical automatically — no `.env` files needed.

---

## Scripts

All scripts live in the `scripts/` directory and can be run from the project root.

| Script | Description |
|--------|-------------|
| `./scripts/setup.sh` | Install all dependencies, verify tooling, check Infisical auth |
| `./scripts/dev.sh` | Start frontend locally with **Fly.io backend** — for cross-machine sessions |
| `./scripts/dev-local.sh` | Start backend (`:5000`) + frontend (`:3000`) both locally — Ctrl+C stops both |
| `./scripts/deploy.sh` | Pre-deploy checks + deploy backend to Fly.io |
| `./scripts/secrets.sh list` | List current production secrets on Fly.io |
| `./scripts/secrets.sh set` | Interactively set all Fly.io production secrets |
| `./scripts/secrets.sh rotate` | Show key rotation checklist |

---

## Architecture

```
CodeLive/
├── frontend/          React 19 + Vite + Tailwind CSS
│   └── src/
├── backend/           Express + TypeScript + Yjs WebSocket
│   ├── src/
│   ├── Dockerfile     Production container
│   └── fly.toml       Fly.io config
├── content/           Question bank (JSON + seed scripts)
├── scripts/           Dev & deploy scripts
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

### With Fly.io backend (recommended for team sessions)

```bash
./scripts/dev.sh
```

Runs only the **frontend** locally at `http://localhost:3000`, proxying all API and WebSocket requests to the deployed Fly.io backend (`codelive-backend.fly.dev`). Both you and your teammate run this — you share the same backend, so collaborative sessions work across machines.

### Fully local (solo development)

```bash
./scripts/dev-local.sh
```

Runs **both** servers on your machine:
- **Backend** at `http://localhost:5000`
- **Frontend** at `http://localhost:3000`

Press **Ctrl+C** to stop both. Good for solo development and testing without internet.

### Running individually

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev
```

### Without Infisical (offline fallback)

If you need to work offline, create `.env` files manually:

```bash
cp backend/.env.example backend/.env   # fill in values
# Create frontend/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

Then run without the `infisical run` wrapper:

```bash
cd backend  && tsx watch src/index.ts
cd frontend && vite
```

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
| `infisical: command not found` | Run the install for your OS — see [SECRETS.md](SECRETS.md) |
| `You must be logged in` | `infisical login` |
| `SUPABASE_URL is undefined` | Check secrets exist in Infisical Dev environment |
| Frontend env vars not loading | Must be prefixed with `VITE_` |
| TypeScript build errors | `cd backend && npx tsc --noEmit` to see details |
| Fly deploy fails | Check `fly auth whoami` and `fly status` |
| WebSocket not connecting | Ensure backend is running and Vite proxy is configured |