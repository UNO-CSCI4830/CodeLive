# Code Live — Frontend

React + Vite + TypeScript + Tailwind CSS frontend for Code Live.

## Quick Start

```bash
npm install
npm run dev      # starts dev server at http://localhost:3000
```

## Environment Setup

```bash
cp frontend/.env.example frontend/.env
```

Then fill in the values in `frontend/.env`. You can find the Supabase keys in the Supabase Dashboard under **Settings → API**.

## Scripts

| Script            | Description                     |
| ----------------- | ------------------------------- |
| `npm run dev`     | Start Vite dev server           |
| `npm run build`   | Production build to `dist/`     |
| `npm run preview` | Preview production build        |
| `npm run lint`    | Run ESLint                      |

## Pages (Assignment 1)

| Route   | Description                                     |
| ------- | ----------------------------------------------- |
| `/`     | Landing page — project intro & feature cards    |
| `/auth` | Login / Signup UI (placeholder, no real auth)   |
| `/role` | Role selection — Candidate or Interviewer       |

## Project Structure

```
src/
├── App.tsx                     # Routes defined here (React Router)
├── main.tsx                    # Entry point
├── index.css                   # Global styles + Tailwind directives
├── components/                 # Shared components
│   └── Navbar/
├── lib/                        # Shared utilities
│   └── role.ts
└── pages/                      # Page modules
    ├── landing/
    │   ├── LandingPage.tsx
    │   ├── components/
    │   ├── styles/
    │   └── tests/
    ├── auth/
    │   ├── AuthPage.tsx
    │   ├── components/
    │   ├── styles/
    │   └── tests/
    └── role/
        ├── RolePage.tsx
        ├── components/
        ├── styles/
        └── tests/
```

## Planned Integrations

- **Supabase Auth** — authentication with email/password
- **Supabase PostgreSQL** — user persistence (profiles, sessions)
- **WebSockets** — live collaboration in interview rooms
- **AI Assistant** — AI-friendly evaluation mode
- **Multi-domain modes** — frontend, backend, database, system design interviews
