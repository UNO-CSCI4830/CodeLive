# CodeLive

**CodeLive is a collaborative technical interview platform.** Interviewers create live sessions from a curated question bank, candidates join with a short code, both sides share an interview workspace, and the interviewer can generate an AI-assisted report after the session.

This repo is a monorepo:

- `frontend/` - React, Vite, TypeScript, Tailwind, Monaco editor
- `backend/` - Express, TypeScript, Supabase, Yjs WebSocket, code execution routes
- `content/` - JSON question bank for leetcode, frontend, backend, and database tasks
- `backend/supabase/migrations/` - Supabase schema migrations

## Quick Start

Install Docker Desktop and the Infisical CLI, then log in:

```bash
infisical login
```

Start the full local app:

```bash
./scripts/dev-local.sh
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/health`

Docker installs dependencies inside containers. You do not need to run `npm install` for normal local development.

## Current Feature Scope

Demo-ready:

- Supabase email auth and role selection
- Interviewer session creation with selected problem queue
- Candidate join by six-character session code
- Real-time session state: lobby, current question, timer pause/resume, completion
- Collaborative code editor via Yjs WebSocket
- AI assistant for candidates, visible read-only to interviewers
- Code execution for leetcode, backend Python, and database SQL tasks
- AI report generation with code snapshots and AI usage logs
- Interviewer reports list and report detail page
- Docker-based local development and Fly.io backend deployment

Partial or intentionally lightweight:

- Calendar UI is present, but calendar invite sending is not a real Google Calendar integration.
- Post-interview messaging, feedback surveys, and rich private rubric notes are not primary demo paths.
- Audio/video transcription is not implemented; reports focus on code snapshots and AI chat logs.

## Common Commands

| Command | Purpose |
| --- | --- |
| `./scripts/dev-local.sh` | Run frontend and backend locally with Docker |
| `./scripts/dev.sh` | Run local frontend against the Fly.io backend |
| `npm --prefix frontend run build` | Type-check and build frontend |
| `npm --prefix frontend run lint` | Run frontend ESLint |
| `npm --prefix frontend test` | Run frontend tests |
| `npm --prefix backend run build` | Type-check backend |
| `npm --prefix backend test` | Run backend tests |
| `./scripts/deploy.sh` | Deploy runner and backend to Fly.io |

## Architecture

```text
Browser
  -> Vite frontend (:3000)
  -> Express API (:5000)
  -> Supabase Auth/Postgres/Realtime
  -> Yjs WebSocket at /ws
  -> Code runner path for execution requests
  -> Anthropic API for assistant/report features
```

Key backend areas:

- `backend/src/routes/session.ts` - session creation, join, state changes, timer control
- `backend/src/routes/run/` - code execution API and runner proxy/direct modes
- `backend/src/routes/ai.ts` - candidate AI assistant and AI chat persistence
- `backend/src/routes/report.ts` - snapshots, AI report generation, report reads
- `backend/src/lib/websocket.ts` - authenticated Yjs WebSocket server

Key frontend areas:

- `frontend/src/pages/session/` - lobby, interview room, layouts, report page
- `frontend/src/pages/question-catalogue/` - browsable question bank and previews
- `frontend/src/lib/AuthContext.tsx` - Supabase auth/profile bootstrapping

## Code Execution Model

Local development uses direct execution inside the backend container for convenience.

Production is configured to fail closed unless the public API proxies execution to a private runner:

```bash
RUN_EXECUTION_MODE=proxy
RUNNER_BASE_URL=http://codelive-runner.internal:5000
RUNNER_SHARED_TOKEN=<shared-secret>
```

The private runner uses:

```bash
RUN_EXECUTION_MODE=direct
RUNNER_SHARED_TOKEN=<same-shared-secret>
```

This keeps the main API process separate from untrusted code execution. See [backend/README.md](backend/README.md) for the local split-runner commands.

## Environment Variables

Secrets are injected by Infisical for local development and Fly secrets for production.

Backend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` optional; AI features degrade if missing
- `CORS_ORIGINS`
- `RUN_EXECUTION_MODE`
- `RUNNER_BASE_URL` for proxy mode
- `RUNNER_SHARED_TOKEN` for production runner mode

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL` optional; defaults through Docker/Vite proxy locally

See [SECRETS.md](SECRETS.md) for secret management details.

## Local Demo Flow

1. Run `./scripts/dev-local.sh`.
2. Open `http://localhost:3000` in two browser profiles or one normal and one private window.
3. Sign in as an interviewer in one window and candidate in the other.
4. Interviewer creates a session and shares the lobby code.
5. Candidate joins with the code.
6. Verify starter code, collaborative edits, AI assistant, run buttons, timer controls, and report generation.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `infisical: command not found` | Install the Infisical CLI; see [local-dev.md](local-dev.md) |
| `You must be logged in` | Run `infisical login` |
| Frontend env vars missing | Ensure they use the `VITE_` prefix |
| Module errors after pulling | Run `docker compose build` |
| Stale dependency volume | Run `docker compose down -v`, then `./scripts/dev-local.sh` |
| WebSocket fails locally | Use `http://localhost:3000`; the browser should connect through Vite's `/ws` proxy |
| Backend tests fail with `EPERM listen` in a sandboxed shell | Run tests in a normal local terminal; Supertest needs to bind a local test server |

## More Docs

- [local-dev.md](local-dev.md) - local setup and daily workflow
- [prod-dev.md](prod-dev.md) - Fly.io deployment workflow
- [backend/README.md](backend/README.md) - backend routes, scripts, and runner setup
- [frontend/README.md](frontend/README.md) - frontend routes and scripts
- [SECRETS.md](SECRETS.md) - Infisical and Fly secret management
