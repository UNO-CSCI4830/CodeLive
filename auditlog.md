# CodeLive Audit Snapshot

Last updated: 2026-04-30

This is a short project-health snapshot for final review and presentation prep.

## Current Strengths

- Strong MVP shape: auth, roles, session creation, candidate join, live editor, AI assistant, execution, and report generation all fit one coherent product.
- Real-time collaboration uses Yjs WebSocket for editor/chat sync and Supabase Realtime for session state.
- Code execution has a production-safe direction: public API in proxy mode, private runner in direct mode.
- Backend now has high-value tests around auth, runner config, reports, and session join/visibility behavior.
- Frontend and backend build commands are working.

## Verification Commands

```bash
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run lint
```

Known note: frontend build warns about a large interview/editor chunk. That warning is expected and does not fail the build.

## Recently Addressed High-Risk Items

- Runner production mode now fails closed unless API-to-runner proxy settings are present.
- Report generation and report reads are interviewer-only.
- Candidate join is guarded against double-claim races.
- Candidate session payload hides future queued problems.
- Local Docker WebSocket URLs now resolve through the browser-safe Vite proxy.
- Starter code renders reliably before collaboration sync finishes.

## Remaining Demo Risks

- Calendar invite UI is not a real Google Calendar integration.
- Post-interview messaging and feedback survey are not core demo paths.
- Audio transcription is not implemented; reports focus on code snapshots and AI usage logs.
- Frontend lint still has warnings, mostly hook dependency/fast-refresh cleanup items.
- The interview/editor bundle should eventually be split further for performance polish.

## Recommended Demo Path

1. Interviewer logs in and creates a session with one or two problems.
2. Candidate joins using the short session code.
3. Show starter code, real-time collaborative editing, timer controls, and run execution.
4. Candidate uses the AI assistant; interviewer observes the log.
5. Interviewer ends the session and generates the report.
6. Show the report summary, per-question analysis, score, and AI usage log.
