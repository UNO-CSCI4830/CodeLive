# CodeLive Frontend

React + Vite + TypeScript frontend for the CodeLive interview experience.

For normal local development, run the full Docker setup from the repo root:

```bash
./scripts/dev-local.sh
```

## Scripts

From `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite with Infisical secrets |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Preview the built app |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest frontend tests |

## Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL` optional backend origin

When running with Docker Compose, `VITE_BACKEND_URL` may be `http://backend:5000`. That hostname is only valid inside Docker; browser API and WebSocket traffic should go through the Vite dev server at `http://localhost:3000`.

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/auth` | Login/signup |
| `/role` | Role selection |
| `/dashboard` | Dashboard with recent reports and session entry |
| `/session/create` | Interviewer create flow and candidate join flow |
| `/session/:sessionId/lobby` | Waiting room |
| `/session/:sessionId` | Full-screen interview workspace |
| `/session/:sessionId/report` | Generated report detail |
| `/reports` | Interviewer report list |
| `/questions` | Question catalogue |
| `/questions/:categorySlug` | Category detail |
| `/questions/:category/:problemId` | Problem preview for supported categories |

## Important Feature Areas

- `src/pages/session/` - session state, lobby, interview room, layouts, reports
- `src/pages/question-catalogue/` - question browsing and previews
- `src/pages/reports/` - report list
- `src/lib/AuthContext.tsx` - Supabase auth and profile loading
- `src/lib/apiClient.ts` - authenticated backend fetch helper

## Session UI Notes

- Candidate edits code; interviewer observes and controls session flow.
- Monaco editors are synchronized through Yjs WebSocket.
- The AI assistant is send-enabled for candidates and read-only for interviewers.
- Starter code is rendered immediately and then synchronized after the WebSocket room connects.

## Build Note

`npm run build` currently warns about a large interview/editor bundle. This is expected because Monaco/Yjs-heavy session routes are still large, but the build passes.
