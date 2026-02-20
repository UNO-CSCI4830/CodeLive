# Code Live

**Live technical interviews that reflect real engineering work.**

Code Live modernises technical interviews to match how engineers actually work — with collaboration, documentation, and AI-assisted reasoning. Instead of contrived algorithm puzzles, Code Live provides a live interview environment where interviewers observe a candidate's real workflow and thinking in real time.

This monorepo contains the **frontend** (React / Vite / TypeScript) and **backend** (Express / TypeScript) for the platform.

## Quick Start

```bash
# Terminal 1 — Frontend (http://localhost:3000)
cd frontend && npm install && npm run dev

# Terminal 2 — Backend  (http://localhost:5000)
cd backend  && npm install && npm run dev
```

Or from the repo root (after installing each package individually):

```bash
npm run dev:frontend   # starts Vite dev server
npm run dev:backend    # starts Express dev server
```

## Assignment 1 Scope

Landing page · Auth UI (login / signup placeholder) · Role selection page.

## Planned Integrations

- **Supabase Auth** — authentication (email/password signup & login)
- **Supabase PostgreSQL** — persistent data store (profiles, sessions, etc.)
- **WebSockets** — live collaboration & interviewer visibility
- **AI Assistant** — AI-friendly evaluation mode
- **Multi-domain interview modes** — frontend, backend, database, system design