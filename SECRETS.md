# Secrets

CodeLive uses Infisical for local development secrets and Fly.io secrets for deployed services. Do not commit `.env` files or secret values.

## Local Development

Install and log in:

```bash
infisical login
```

Run the app from the repo root:

```bash
./scripts/dev-local.sh
```

The script injects both backend and frontend secrets into Docker Compose. Team members only need access to the CodeLive Infisical project.

## Required Secrets

Backend:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key; keep private |
| `ANTHROPIC_API_KEY` | Optional AI assistant/report key |
| `CORS_ORIGINS` | Allowed browser origins |
| `RUN_EXECUTION_MODE` | `direct` locally/private runner, `proxy` for production API |
| `RUNNER_BASE_URL` | Private runner URL when proxying |
| `RUNNER_SHARED_TOKEN` | Shared API-to-runner secret |

Frontend:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL exposed to browser |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key exposed to browser |
| `VITE_BACKEND_URL` | Optional backend origin override |

Frontend variables must start with `VITE_` or Vite will not expose them.

## Production

Fly.io services use Fly secrets, not runtime Infisical.

```bash
./scripts/secrets.sh set-from-infisical dev /Backend
```

Then deploy:

```bash
./scripts/deploy.sh
```

Production API should use:

```bash
RUN_EXECUTION_MODE=proxy
RUNNER_BASE_URL=http://codelive-runner.internal:5000
RUNNER_SHARED_TOKEN=<long-random-token>
```

Production runner should use:

```bash
RUN_EXECUTION_MODE=direct
RUNNER_SHARED_TOKEN=<same-token>
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `infisical: command not found` | Install the Infisical CLI; see `local-dev.md` |
| `You must be logged in` | Run `infisical login` |
| Secrets are empty in Docker | Confirm you have access to both `/Backend` and `/Frontend` paths |
| Frontend env missing | Check the variable name starts with `VITE_` |
| AI unavailable | Verify `ANTHROPIC_API_KEY`; the app can still run without it |
