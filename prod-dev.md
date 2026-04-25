# Prod Dev (Fly + Local Frontend)

Use this to deploy backend services to Fly, then run frontend locally.

## 1. One-time setup

Install **Docker Desktop**, **Infisical CLI**, and **Fly CLI** — see [local-dev.md](local-dev.md) for Docker and Infisical install instructions.

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Log in
infisical login
fly auth login
```

## 2. Create Fly apps (only first time)

```bash
fly apps create codelive-runner
fly apps create codelive-backend
```

If app already exists, Fly will tell you; continue.

## 3. Sync secrets from Infisical to Fly

```bash
./scripts/secrets.sh set-from-infisical dev /Backend
```

## 4. Deploy both services

```bash
./scripts/deploy.sh
```

This deploys:
- `codelive-runner` first
- `codelive-backend` second

## 5. Verify production health

```bash
curl https://codelive-backend.fly.dev/health
```

Expected:

```json
{"status":"ok"}
```

## 6. Start frontend locally against production backend

```bash
./scripts/dev.sh
```

- Frontend: http://localhost:3000
- Backend (prod): https://codelive-backend.fly.dev

> **First run only:** Docker builds the frontend image (~1 minute). Every run after that is instant.

---

## Re-deploy after backend changes

```bash
./scripts/secrets.sh set-from-infisical dev /Backend
./scripts/deploy.sh
```
