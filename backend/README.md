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
| `npm run build` | Compile TypeScript to `dist/`        |
| `npm run start` | Run compiled output from `dist/`     |

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
