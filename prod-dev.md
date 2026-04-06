# Prod Dev (Fly + Local Frontend)

Use this to deploy backend services to Fly, then run frontend locally.

## 1. One-time setup

```bash
git clone <your-repo-url>
cd CodeLive
./scripts/setup.sh
infisical login
fly auth login
```

`./scripts/setup.sh` handles required `npm install` steps.

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

Open:
- Frontend: `http://localhost:3000`
- Backend (prod): `https://codelive-backend.fly.dev`

---

## Re-deploy after backend changes

```bash
./scripts/secrets.sh set-from-infisical dev /Backend
./scripts/deploy.sh
```
