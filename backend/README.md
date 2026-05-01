# CodeLive Backend

Express + TypeScript backend for auth-aware sessions, collaboration, code execution, AI assistance, and interview reports.

For normal local development, run the full Docker setup from the repo root:

```bash
./scripts/dev-local.sh
```

## Scripts

From `backend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start API with Infisical secrets and hot reload |
| `npm run dev:runner` | Start the runner service locally |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled API |
| `npm run start:runner` | Run compiled runner |
| `npm test` | Run Vitest backend tests |

## Main Routes

| Area | Routes |
| --- | --- |
| Health/version | `GET /health`, `GET /api/version` |
| Sessions | `POST /api/sessions`, `POST /api/sessions/join`, `GET /api/sessions/:id`, session state/timer routes |
| Content | `/api/content/*` |
| Code execution | `/api/run/*` |
| AI assistant | `POST /api/ai/chat` |
| Reports | `/api/sessions/:sessionId/report`, snapshots, AI logs |
| Groups/profile/dashboard | `/api/groups`, `/api/profile`, `/api/dashboard` |

HTTP requests use Supabase JWT auth where required. WebSocket collaboration is attached at `/ws`.

## Environment Variables

Backend basics:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` optional for AI features
- `PORT` defaults to `5000`
- `CORS_ORIGINS` defaults to `http://localhost:3000`

Runner/proxy mode:

- `RUN_EXECUTION_MODE` - `direct` for local/private runner, `proxy` for production API
- `RUNNER_BASE_URL` - required when API is in `proxy` mode
- `RUNNER_SHARED_TOKEN` - required in production for API-to-runner trust

## Code Execution Modes

Local Docker development runs execution directly inside the backend container.

Production should split execution:

- API app: sessions, reports, content, AI, and `/api/run/*` proxying
- Runner app: private service that directly runs code

Production API:

```bash
NODE_ENV=production
RUN_EXECUTION_MODE=proxy
RUNNER_BASE_URL=http://codelive-runner.internal:5000
RUNNER_SHARED_TOKEN=<long-random-token>
```

Production runner:

```bash
NODE_ENV=production
RUN_EXECUTION_MODE=direct
RUNNER_SHARED_TOKEN=<same-token>
```

## Local Split Runner

Terminal 1:

```bash
cd backend
RUN_EXECUTION_MODE=direct \
PORT=5001 \
RUNNER_SHARED_TOKEN=dev-runner-token \
RUN_RATE_LIMIT_ENABLED=false \
npm run dev:runner
```

Terminal 2:

```bash
cd backend
RUN_EXECUTION_MODE=proxy \
PORT=5000 \
RUNNER_BASE_URL=http://localhost:5001 \
RUNNER_SHARED_TOKEN=dev-runner-token \
npm run dev
```

## Fly Deployment Notes

Deploy from the repo root so the Docker build includes `/content`:

```bash
fly deploy --config backend/fly.runner.toml .
fly deploy --config backend/fly.toml .
```

Keep the runner private-only. The public backend should reach it through Fly private DNS.
