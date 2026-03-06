# Secret Management — Infisical

Code Live uses **[Infisical](https://infisical.com)** for secret management. Secrets are never committed to the repo — they're injected at runtime via the Infisical CLI.

> **No `.env` files need to be shared.** Once set up, `npm run dev` pulls secrets automatically.

---

## First-Time Setup (New Team Member)

### 1. Install the Infisical CLI

```bash
# Ubuntu / Debian
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash
sudo apt-get install infisical

# macOS
brew install infisical/get-cli/infisical

# Windows (via Scoop)
scoop bucket add infisical https://github.com/Infisical/scoop-infisical.git
scoop install infisical
```

Verify it works:

```bash
infisical --version
```

### 2. Log in

```bash
infisical login
```

This opens a browser window. Sign in with your Infisical account. If you don't have one yet, ask the project owner to invite you to the **CodeLive** organization.

### 3. Initialize both directories

The `.infisical.json` files are already committed to the repo, so this step is only needed if they're missing:

```bash
cd backend  && infisical init   # select the CodeLive project
cd ../frontend && infisical init
```

### 4. Run the app

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd backend && npm install && npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend && npm install && npm run dev
```

That's it — `npm run dev` wraps the start command with `infisical run`, which injects all secrets from the **Development** environment as environment variables.

---

## How It Works

The `dev` scripts in each `package.json` are prefixed with `infisical run --`:

```
backend/package.json  → "dev": "infisical run -- tsx watch src/index.ts"
frontend/package.json → "dev": "infisical run -- vite"
```

`infisical run` fetches secrets from the Infisical cloud, sets them as `process.env` / `import.meta.env` variables, then executes the command that follows `--`.

---

## Required Secrets

### Backend

| Variable                     | Required | Description                                                |
| ---------------------------- | -------- | ---------------------------------------------------------- |
| `SUPABASE_URL`               | ✅       | Supabase project URL (Dashboard → Settings → API)          |
| `SUPABASE_ANON_KEY`          | ✅       | Supabase public anon key                                   |
| `SUPABASE_SERVICE_ROLE_KEY`  | ✅       | Supabase service role key (bypasses RLS — keep secret)     |
| `ANTHROPIC_API_KEY`          | ⚠️       | Anthropic API key — AI features degrade gracefully without |
| `PORT`                       | ❌       | Server port (defaults to `5000`)                           |
| `CORS_ORIGINS`               | ❌       | Comma-separated allowed origins (defaults to `http://localhost:3000`) |

### Frontend

| Variable                 | Required | Description                       |
| ------------------------ | -------- | --------------------------------- |
| `VITE_SUPABASE_URL`     | ✅       | Same Supabase project URL         |
| `VITE_SUPABASE_ANON_KEY`| ✅       | Same Supabase public anon key     |

> **Note:** Frontend variables must be prefixed with `VITE_` so Vite exposes them to the browser.

---

## Managing Secrets

### Via the Dashboard (recommended)

1. Go to [app.infisical.com](https://app.infisical.com)
2. Open the **CodeLive** project
3. Select the environment (**Development**, **Staging**, or **Production**)
4. Add, edit, or remove secrets

### Via the CLI

```bash
# List all secrets for the current environment
infisical secrets

# Set a secret
infisical secrets set MY_KEY="my_value"

# Delete a secret
infisical secrets delete MY_KEY
```

---

## Environments

| Environment   | Used by                            |
| ------------- | ---------------------------------- |
| **Development** | Local development (`npm run dev`) |
| **Staging**     | Preview / testing deployments     |
| **Production**  | Fly.io / production deployment    |

To run with a specific environment:

```bash
infisical run --env=staging -- npm run dev
```

---

## Production (Fly.io)

For production deployments on Fly.io, secrets are set via `fly secrets set` (not Infisical) since the CLI isn't available inside the Docker container:

```bash
cd backend
fly secrets set \
  SUPABASE_URL="..." \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  ANTHROPIC_API_KEY="..." \
  CORS_ORIGINS="https://your-frontend-domain.com"
```

Alternatively, you can use Infisical's [native integrations](https://infisical.com/docs/integrations/overview) to sync secrets directly to Fly.io.

---

## Local `.env` Fallback

If you need to work offline or without the Infisical CLI, you can create local `.env` files. They're gitignored and won't be committed:

```bash
# backend/.env
cp backend/.env.example backend/.env
# Fill in the values

# frontend/.env
# Create manually with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

Then run the underlying commands directly (without `infisical run`):

```bash
cd backend  && tsx watch src/index.ts
cd frontend && vite
```

---

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `infisical: command not found` | Re-run the install step for your OS |
| `You must be logged in` | Run `infisical login` |
| `Failed to fetch secrets` | Check your internet connection; verify you have access to the project in the Infisical dashboard |
| `SUPABASE_URL is undefined` | Ensure the secret exists in the correct environment (Development) |
| Frontend env vars not loading | Ensure they're prefixed with `VITE_` |
