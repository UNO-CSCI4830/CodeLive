# CodeLive Practical Audit Log

Audit date: 2026-04-08

Scope note:
- This audit reflects the current checked-out worktree, including uncommitted changes.
- Verification performed:
  - `npm --prefix backend run build` -> passes
  - `npm --prefix frontend run build` -> passes, but emits large-chunk warnings
  - `npm --prefix frontend run lint` -> fails because no ESLint config exists
  - No test suite or test runner config was found

## 1) Executive Summary

### Overall strengths

- The project has a genuinely interesting full-stack concept with strong portfolio appeal: real-time collaborative interviewing, AI assistance, report generation, and a structured content bank.
- The backend shows production awareness in several places: `helmet`, CORS allowlisting, rate limiting, explicit auth middleware, and an isolated runner deployment mode.
- The frontend already uses route-level lazy loading for heavy editor experiences and has thoughtful session-oriented UX.
- The schema demonstrates good product thinking: sessions, ordered problems, snapshots, AI message logs, interviewer groups, and generated reports.

### Biggest risks

- The code execution runner is not safely sandboxed enough for untrusted code.
- Authorization is inconsistent because the backend uses a service-role Supabase client everywhere, so any missed route check becomes a data exposure bug.
- The migration history is not reproducible from scratch because `006_session_total_timer.sql` references `profiles` before `009_profiles.sql` creates it.
- The codebase has almost no enforceable quality gates: no working lint setup, no tests, no CI.
- Several core frontend files are very large and mix orchestration, data flow, and rendering, which will slow future changes and code review quality.

### Already portfolio-worthy

- Real-time collaboration architecture with Yjs + WebSocket + Supabase.
- The session/report domain model.
- The dedicated runner split concept for safer code execution.
- Interview content modeling with manifests and multiple domains.
- A full-stack product narrative that feels closer to a real startup MVP than a toy CRUD app.

### What still feels prototype-level

- Broken lint workflow.
- No test coverage.
- Manual validation and ad hoc authz checks in route handlers.
- Mixed frontend data access patterns: some domains use backend APIs, others query Supabase directly.
- Several placeholder or partially finished surfaces such as waitlist/calendar integrations and very large orchestration components.

### What would impress an interviewer

- The ambition and coherence of the product.
- The real-time collaboration layer.
- The report-generation pipeline and content system.
- The security-minded instinct to separate execution into a runner service.

### What should be improved before demoing or putting on a resume

- Fix the migration reproducibility issue.
- Tighten authz around reports and session joins.
- Add a real lint config and a handful of high-value integration tests.
- Reduce the biggest frontend components and standardize data boundaries.
- Harden or clearly constrain the untrusted code execution story.

### Scores

| Area | Score | Notes |
|---|---:|---|
| Code quality | 6/10 | Many good instincts, but large files and repeated ad hoc patterns reduce confidence. |
| Architecture | 7/10 | Strong product shape and good monolith fit, but boundaries are inconsistent. |
| Maintainability | 5/10 | Too much logic sits in route/page files and there are no real guardrails yet. |
| Security hygiene | 4/10 | Some solid basics, but runner isolation and authz gaps are important. |
| Scalability readiness | 5/10 | Fine for MVP growth, but needs cleaner layers and safer execution boundaries. |
| Team collaboration readiness | 4/10 | Broken lint, no tests, no CI, and large files hurt review quality. |
| Portfolio strength | 7/10 | Strong concept and impressive features; a few fixes would raise this materially. |

## 2) Architecture Review

### Current assessment

- The repo structure is sensible for this stage: `frontend/`, `backend/`, `content/`, `scripts/`, and migrations are easy to understand.
- The overall architectural choice should remain a monolith for now. This is the right level of engineering for a class project with real ambitions.
- The biggest architectural weakness is not top-level structure; it is boundary inconsistency inside the app.

### What is working

- Frontend, backend, and content are clearly separated.
- The runner split is the right future boundary.
- The data model supports future analytics and richer reports.

### Underengineering that will cause pain soon

- Route handlers are doing validation, authorization, DB access, and response shaping directly.
- Frontend pages mix orchestration, state machines, API coordination, and rendering in one file.
- Some product domains go through the backend, while others go directly from browser to Supabase.

### Overengineering to avoid

- Do not split this into multiple product services.
- Do not build a generic plugin architecture or generalized domain framework.
- Do not introduce a heavy state-management library unless repeated cross-page pain appears.

### Weak boundaries and repeated patterns

- `backend/src/routes/session.ts`
- `backend/src/routes/report.ts`
- `frontend/src/pages/session/create/CreateSessionPage.tsx`
- `frontend/src/pages/session/interview/InterviewSessionPage.tsx`
- `frontend/src/pages/session/layouts/*.tsx`
- `frontend/src/pages/reports/ReportsListPage.tsx`

### Practical target architecture

- Backend:
  - Keep Express.
  - Add lightweight `validators/`, `services/`, and `repositories/`.
  - Centralize participant/interviewer authorization helpers.
  - Use a shared error-response shape and error middleware.
- Frontend:
  - Keep feature folders.
  - Split page orchestration from presentational components.
  - Centralize API access through feature APIs/hooks.
  - Stop mixing backend API reads with direct table reads for the same domain.
- Data layer:
  - Keep Supabase/Postgres.
  - Fix migration order.
  - Add a few carefully chosen constraints and indexes where authz and query behavior depend on them.

## 3) Code Quality Review

### Strengths

- Naming is generally readable and domain-oriented.
- Comments are often helpful and explain intent rather than narrating syntax.
- TypeScript strictness is enabled in both frontend and backend.

### Main issues

- Core files are too large:
  - `frontend/src/pages/session/create/CreateSessionPage.tsx` is 711 lines.
  - `frontend/src/pages/session/interview/InterviewSessionPage.tsx` is 480 lines.
  - `frontend/src/pages/session/components/AIAssistant.tsx` is 464 lines.
  - `frontend/src/pages/dashboard/DashboardPage.tsx` is 419 lines.
  - `frontend/src/pages/session/layouts/BackendSessionLayout.tsx` is 417 lines.
- Large files mix responsibilities:
  - data fetching,
  - auth/role behavior,
  - UI composition,
  - modal handling,
  - retries,
  - background workflows.
- Validation is repetitive and manual in backend routes.
- Several domains use `any`-like casting patterns in the frontend (`ReportsListPage.tsx`).
- Some comments and READMEs describe an earlier stage of the project rather than the current one.

### Code that would get called out in a strong internship/new grad review

- Disabled lint rules to suppress dependency correctness in auth bootstrapping:
  - `frontend/src/lib/AuthContext.tsx:118`
- Mixed direct Supabase queries and backend API usage:
  - `frontend/src/lib/AuthContext.tsx:49`
  - `frontend/src/pages/reports/ReportsListPage.tsx:64`
- Giant orchestration components that are hard to review safely:
  - `frontend/src/pages/session/interview/InterviewSessionPage.tsx:35`
  - `frontend/src/pages/session/create/CreateSessionPage.tsx:30`
- Route files that own too much behavior:
  - `backend/src/routes/session.ts`
  - `backend/src/routes/report.ts`

### Recommended code-quality improvements

- Introduce schema validation at route edges.
- Break large session pages into:
  - controller hook,
  - view components,
  - isolated async helpers.
- Add `services/` and `repositories/` for session/report logic.
- Replace repeated `res.ok` + `err.error` patterns with a typed API helper on the frontend.

## 4) Security and Safe Coding Review

### Security issue table

| Issue | Why it matters | Likelihood | Severity | Easy fix | Ideal fix |
|---|---|---:|---:|---|---|
| Untrusted Python executes with only process-level limits in `runPython` | Authenticated users can run arbitrary code on infrastructure with filesystem and network access; `-I` is not a sandbox | High if exposed to real users | High | Restrict usage to trusted/demo environments and the private runner only | Move execution into a container/VM sandbox with network off, tighter seccomp/fs isolation, CPU/memory quotas |
| Candidate can hit report endpoints because participant auth is reused for interviewer-only actions | Reports and snapshots should be interviewer-owned workflows, but service-role backend bypasses RLS | Medium | High | Add explicit interviewer-only checks to snapshot/report routes | Centralize authz helpers and keep report data behind interviewer-only services |
| Candidate join flow is race-prone | Two candidates could attempt to claim the same waiting session because update is not conditional on `status='waiting'` and `candidate_id is null` | Medium | High | Add conditional update guards and return conflict on zero rows updated | Wrap join in a DB transaction or RPC that atomically claims the session |
| WebSocket auth accepts tokens in query params | Query params can leak via logs, proxies, browser history tooling, and observability systems | Medium | Medium | Prefer header/subprotocol transport and deprecate query param support | Use a short-lived WS token or cookie/session-backed upgrade auth |
| Future problem list is sent to the candidate | Interview integrity can be weakened because the candidate receives all queued problem IDs | Medium | Medium | Return only current problem to candidates | Add role-aware session shaping endpoints for interviewer vs candidate |
| Preview sandbox loads React from `unpkg` and injects error HTML via `innerHTML` | Runtime dependency mismatch and HTML injection in sandboxed preview reduce reliability and create avoidable risk | Medium | Medium | Bundle preview dependencies locally and render errors with text nodes | Move preview execution to a more controlled local bundling/sandbox pipeline |

### Evidence

- Untrusted code execution:
  - `backend/src/routes/run/pythonExecutor.ts:45`
  - `backend/src/routes/run/handlers/runBackendPython.ts:52`
  - `backend/src/routes/run/handlers/runLeetcodePython.ts:37`
- Report authz reuse:
  - `backend/src/routes/report.ts:29`
  - `backend/src/routes/report.ts:115`
  - `backend/src/routes/report.ts:156`
  - `backend/src/routes/report.ts:195`
- Join race:
  - `backend/src/routes/session.ts:183`
  - `backend/src/routes/session.ts:216`
- WebSocket query token:
  - `backend/src/lib/websocket.ts:173`
  - `backend/src/lib/websocket.ts:184`
- Future problem leakage:
  - `backend/src/routes/session.ts:272`
  - `backend/src/routes/session.ts:279`
- Preview sandbox:
  - `frontend/src/pages/question-catalogue/frontendpreview/components/LivePreview.tsx:92`
  - `frontend/src/pages/question-catalogue/frontendpreview/components/LivePreview.tsx:136`

### Security hygiene already present

- `helmet` and CORS allowlisting:
  - `backend/src/index.ts:31`
  - `backend/src/index.ts:40`
- Global and run-specific rate limiting:
  - `backend/src/index.ts:52`
  - `backend/src/routes/run/index.ts`
- Service-role client is clearly labeled as dangerous:
  - `backend/src/lib/supabase.ts:13`

## 5) Backend / API Review

### Positive signals

- The API surface is understandable by feature.
- Error responses are usually human readable.
- The backend already separates health/version, sessions, reports, content, run, AI, and groups.

### Main problems

- Too much business logic is embedded in routes.
- Validation is manual and inconsistent.
- Authorization rules are repeated inline.
- Response shaping is inconsistent across routes.
- Background behavior is implicit rather than modeled as a job or clearly tracked workflow.

### Specific flags

- `backend/src/routes/session.ts`
  - fat route handler pattern,
  - repeated authz checks,
  - concurrency-sensitive flows without atomic DB guards.
- `backend/src/routes/report.ts`
  - participant/interviewer permissions are collapsed together,
  - report generation input trusts the client-provided `problems` array too much,
  - background generation is fire-and-forget with minimal observability.
- `backend/src/routes/dashboard.ts`
  - does role lookup, multiple queries, response shaping, and display-name stitching inside the route.

### Practical backend target

- Add:
  - `sessionService`,
  - `reportService`,
  - `dashboardService`,
  - `groupService`.
- Add request schemas for every non-trivial POST/PATCH.
- Add centralized authz helpers such as:
  - `requireInterviewerForSession`,
  - `requireParticipantForSession`,
  - `requireCandidateForSession`.

## 6) Frontend Review

### Strengths

- Route-level lazy loading is already in place.
- Session UX is thoughtfully designed for a real interview flow.
- The collaborative editor and AI panel are interesting, differentiated product work.

### Main issues

- Several components are too large to review comfortably.
- State, data fetching, derived data, and rendering are frequently combined.
- Data access is inconsistent:
  - backend API in some places,
  - direct Supabase table access in others.
- Some pages use custom in-memory caching without invalidation or TTL semantics.
- Accessibility is mixed; forms are generally decent, but tables/cards and keyboard flows deserve another pass.

### Specific flags

- Mixed data boundaries:
  - `frontend/src/lib/AuthContext.tsx:49`
  - `frontend/src/pages/reports/ReportsListPage.tsx:64`
- Giant orchestration pages:
  - `frontend/src/pages/session/create/CreateSessionPage.tsx:30`
  - `frontend/src/pages/session/interview/InterviewSessionPage.tsx:35`
  - `frontend/src/pages/session/components/AIAssistant.tsx:59`
- Preview runtime mismatch:
  - app uses React 19,
  - preview iframe pulls React 18 from CDN:
    - `frontend/package.json:17`
    - `frontend/src/pages/question-catalogue/frontendpreview/components/LivePreview.tsx:92`

### Practical frontend target

- Keep feature folders, but split large routes into:
  - `useXController` hooks,
  - smaller presentational components,
  - dedicated async/state helpers.
- Standardize product-data reads through backend APIs.
- Consider a lightweight query library later only if custom caching keeps spreading.

## 7) Database / Data Layer Review

### Strengths

- The schema tells a coherent product story.
- `sessions`, `session_problems`, `code_snapshots`, `session_ai_messages`, `interview_reports`, and `interviewer_groups` form a convincing data model.
- The model is interview-friendly and analytics-friendly.

### Strong interview/resume signal

- Ordered session problems and per-question snapshots show good product/data design.
- AI message logging and interviewer grouping suggest forward thinking about evaluation quality and analytics.

### Main issue

- Migration reproducibility is currently broken.

### Evidence

- `backend/supabase/migrations/006_session_total_timer.sql:29` references `profiles`
- `backend/supabase/migrations/009_profiles.sql:10` creates `profiles`

### Why this matters

- This is one of the fastest ways to lose reviewer confidence.
- A clean environment may not reproduce successfully.
- It signals schema drift and out-of-band database work.

### Recommended fixes

- Create a new migration that safely introduces `profiles` earlier or removes backward references from older migrations.
- Treat migration replay on a clean database as a required check before demoing.

## 8) Testing Review

### Current state

- No meaningful test suite was found.
- No `vitest`, `jest`, or `playwright` config was found.
- No CI workflow was found.

### Confidence for refactors

- Low.
- Large session and report flows can regress silently.
- Authz bugs are especially likely because the service-role backend makes route correctness the only real guardrail.

### Highest ROI tests to add next

1. Backend integration tests for:
   - session creation,
   - join-session race/conflict behavior,
   - interviewer-only actions,
   - report endpoint permissions.
2. Frontend smoke tests for:
   - auth/layout redirect behavior,
   - create/join session flow,
   - report page loading/error states.
3. One end-to-end happy path:
   - interviewer creates session,
   - candidate joins,
   - session ends,
   - report appears.

## 9) Performance and Scale Review

### Worth fixing now

- The interview session bundle is too large for the product’s most important route:
  - frontend build output shows `InterviewSessionPage` at about 2.7 MB minified.
- Preview sandbox depends on runtime CDN scripts, which slows and destabilizes preview.
- Some pages do extra client-side stitching queries that should be consolidated.
- Large static catalogue data in the frontend increases maintenance cost and bundle weight pressure.

### Probably okay to ignore for class scope

- Advanced DB read replicas or caching tiers.
- Background job infrastructure beyond lightweight async report generation.
- Multi-region websocket concerns.
- High-scale analytics pipelines.

## 10) DevEx + Resume Signal Review

### What impresses recruiters

- This is not another CRUD dashboard. The collaboration/reporting/interview product story is memorable.
- The runner split and real-time collaboration work show systems thinking.
- The schema and product features suggest strong ownership beyond UI polish.

### What weakens the story

- Broken lint command.
- No tests or CI.
- Migration drift.
- Security story around running arbitrary code is not yet strong enough.
- Some READMEs still describe the app as a scaffold or placeholder, which undersells the actual work.

### Best resume-signal improvements

1. Fix migration replay from scratch and mention reproducible infra/schema.
2. Add working linting and a small but meaningful integration test suite.
3. Tighten report/session authz and runner isolation story.
4. Refactor the biggest frontend orchestration files into cleaner feature boundaries.
5. Reduce the interview route bundle size and remove runtime CDN preview dependencies.

## Prioritized Issues

### P0

- Fix migration replay/drift:
  - `backend/supabase/migrations/006_session_total_timer.sql:29`
  - `backend/supabase/migrations/009_profiles.sql:10`
- Lock down untrusted code execution more clearly:
  - `backend/src/routes/run/pythonExecutor.ts:45`

### P1

- Make report routes interviewer-only where intended:
  - `backend/src/routes/report.ts:115`
  - `backend/src/routes/report.ts:156`
  - `backend/src/routes/report.ts:195`
- Make session join atomic/conflict-safe:
  - `backend/src/routes/session.ts:183`
  - `backend/src/routes/session.ts:216`
- Add real lint config so `npm run lint` works:
  - `frontend/package.json:11`

### P2

- Standardize data boundaries and reduce direct Supabase reads in UI:
  - `frontend/src/lib/AuthContext.tsx:49`
  - `frontend/src/pages/reports/ReportsListPage.tsx:64`
- Break up oversized frontend orchestration files:
  - `frontend/src/pages/session/create/CreateSessionPage.tsx:30`
  - `frontend/src/pages/session/interview/InterviewSessionPage.tsx:35`
  - `frontend/src/pages/session/components/AIAssistant.tsx:59`
- Remove WS query-token support after a transition period:
  - `backend/src/lib/websocket.ts:184`

## Deferred Improvements

- Full observability stack with structured logs and tracing.
- Fancy client caching/query orchestration libraries.
- Multi-runner scheduling or autoscaling complexity.
- Search/index infrastructure for content.
- Enterprise-grade audit/event logs for every session action.

## Things Intentionally Ignored For Class Scope

- Microservice decomposition.
- Complex role/permission administration UI.
- Fine-grained analytics warehouse work.
- Heavy platform work that does not improve demo reliability or recruiter signal.

## Fix Before Next Feature

- Migration reproducibility.
- Report and session authz correctness.
- Join-session concurrency safety.
- Working lint configuration.
- At least a minimal integration test harness for core session flows.

## Safe to Ignore for Class Scope

- Multi-region concerns.
- Deep observability tooling.
- Enterprise workflow engines and job queues.
- Ultra-optimized data access patterns for large traffic.

## Best Resume Wins

- Reproducible schema and clean setup.
- Working lint/tests/CI basics.
- A clear security story around code execution.
- Cleaner frontend feature boundaries.
- Lower-friction demo performance on the interview route.

## Preserve These Strengths

- The ambitious but coherent product concept.
- The real-time collaboration architecture.
- The session/report data model.
- The practical monolith structure.
- The instinct to add real production-aware touches without overbuilding.
