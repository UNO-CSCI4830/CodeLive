# Code Live — Backend

Minimal Express + TypeScript server scaffold for Code Live.

## Quick Start

```bash
npm install
npm run dev      # starts dev server with hot reload (tsx watch)
```

## Environment Setup

```bash
cp backend/.env.example backend/.env
```

Then fill in the values in `backend/.env`. You can find the Supabase keys in the Supabase Dashboard under **Settings → API**.

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start dev server with hot reload     |
| `npm run dev:runner` | Start isolated runner service locally |
| `npm run build` | Compile TypeScript to `dist/`        |
| `npm run start` | Run compiled output from `dist/`     |
| `npm run start:runner` | Run compiled isolated runner from `dist/` |

## Endpoints (Assignment 1)

| Method | Path           | Response                                          |
| ------ | -------------- | ------------------------------------------------- |
| GET    | `/health`      | `{ "status": "ok" }`                              |
| GET    | `/api/version` | `{ "name": "code-live-backend", "version": "0.1.0" }` |

## Planned Integrations

- **Supabase PostgreSQL** — persistent data store (profiles, sessions)
- **WebSockets** — live collaboration between candidate & interviewer
- **Domain APIs** — endpoints for interview sessions, code execution, AI evaluation
- Authentication is handled via **Supabase Auth**; the backend validates JWTs via auth middleware

## Isolated Runner Split (Recommended)

The backend now supports a strong split:

- **API app** (`dist/index.js`): profiles/sessions/content/reporting + run request proxy.
- **Runner app** (`dist/runner.js`): only execution routes (`/api/run/*`) in a dedicated service.

### Local split setup

Terminal 1 (runner):

```bash
cd backend
RUN_EXECUTION_MODE=direct \
PORT=5001 \
RUNNER_REQUIRE_TOKEN=true \
RUNNER_SHARED_TOKEN=dev-runner-token \
RUN_RATE_LIMIT_ENABLED=false \
npm run dev:runner
```

Terminal 2 (api):

```bash
cd backend
RUN_EXECUTION_MODE=proxy \
PORT=5000 \
RUNNER_BASE_URL=http://localhost:5001 \
RUNNER_SHARED_TOKEN=dev-runner-token \
npm run dev
```

### Fly deployment split

Deploy from repo root so `/content` is included in the image:

```bash
fly deploy --config backend/fly.runner.toml .
fly deploy --config backend/fly.toml .
```

Set the same strong `RUNNER_SHARED_TOKEN` secret on both apps:

```bash
fly secrets set RUNNER_SHARED_TOKEN='replace-with-long-random-token' -a codelive-runner
fly secrets set RUNNER_SHARED_TOKEN='replace-with-long-random-token' -a codelive-backend
```

For runner hardening, keep it private-only:

1. Do not attach a public IPv4 to `codelive-runner`.
2. If one exists, release it with `fly ips release <ip> -a codelive-runner`.
3. API reaches runner over private DNS (`http://codelive-runner.internal:5000`).
