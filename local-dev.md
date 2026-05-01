# Local Development

Use this guide to run CodeLive on your machine.

## One-Time Setup

Install:

- Docker Desktop: https://docs.docker.com/get-started/get-docker/
- Infisical CLI:

```bash
# macOS
brew install infisical/get-cli/infisical

# Ubuntu / Debian
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash
sudo apt-get install infisical

# Windows with Scoop
scoop bucket add infisical https://github.com/Infisical/scoop-infisical.git
scoop install infisical
```

Then log in:

```bash
infisical login
```

Ask the project owner for access to the CodeLive Infisical project. The repo already contains the Infisical project config, so you should not need to run `infisical init`.

## Run the Full App Locally

```bash
./scripts/dev-local.sh
```

URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

The first run builds Docker images. Later runs reuse the images and container-managed `node_modules` volumes.

## Run Frontend Against Fly Backend

Use this when the deployed backend is healthy and you only want to work on UI:

```bash
./scripts/dev.sh
```

URLs:

- Frontend: `http://localhost:3000`
- Backend: `https://codelive-backend.fly.dev`

## Testing a Session Locally

Use two browser profiles or one normal window and one private window:

1. Sign in as an interviewer.
2. Create a session and copy the six-character code.
3. Sign in as a candidate in the second window.
4. Join with the code.
5. Confirm editor sync, AI assistant, run buttons, timer controls, and report generation.

For local Docker runs, the frontend may receive `VITE_BACKEND_URL=http://backend:5000`, but the browser should still connect through `localhost:3000` for API and WebSocket proxying. Do not manually open `http://backend:5000` in the browser; that hostname only exists inside Docker.

## After Pulling Changes

If dependency files or Dockerfiles changed:

```bash
docker compose build
```

If dependency errors persist:

```bash
docker compose down -v
./scripts/dev-local.sh
```

## Quality Checks

Run these before presenting or submitting:

```bash
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run lint
```

The frontend build currently emits a large chunk warning for the interview/editor bundle. That is expected and does not fail the build.
