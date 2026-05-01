# Production Development

Use this when deploying the backend/runner to Fly.io or running the local frontend against the deployed backend.

## One-Time Setup

Install Docker Desktop, Infisical CLI, and Fly CLI.

```bash
infisical login
fly auth login
```

Create the apps once if they do not already exist:

```bash
fly apps create codelive-runner
fly apps create codelive-backend
```

## Sync Secrets

```bash
./scripts/secrets.sh set-from-infisical dev /Backend
```

Production must include a strong `RUNNER_SHARED_TOKEN` on both apps. The public API should proxy execution to the private runner.

## Deploy

```bash
./scripts/deploy.sh
```

The deploy script builds/checks the project, deploys `codelive-runner`, then deploys `codelive-backend`.

## Verify

```bash
curl https://codelive-backend.fly.dev/health
fly status --app codelive-backend
fly logs --app codelive-backend
```

Expected health response:

```json
{"status":"ok"}
```

## Run Local Frontend Against Fly Backend

```bash
./scripts/dev.sh
```

- Frontend: `http://localhost:3000`
- Backend: `https://codelive-backend.fly.dev`

This is useful for cross-machine collaboration testing because everyone points at the same backend.

## Redeploy After Backend Changes

```bash
npm --prefix backend run build
npm --prefix backend test
./scripts/secrets.sh set-from-infisical dev /Backend
./scripts/deploy.sh
```
