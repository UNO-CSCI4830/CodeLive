# CodeLive AI Engineering Guardrails

This file is the working constitution for future AI-assisted development in this repo.
It is optimized for a strong class project with real-world habits, not enterprise ceremony.

## Core Standard

- Ship fast, but do not ship confusion.
- Prefer a clean monolith over premature service splitting.
- Favor boring, explicit code over clever abstractions.
- Every new feature should leave the codebase easier to understand than before.
- Optimize for demo reliability, reviewability, and future extension.

## Product Stage Rules

- Treat this as a portfolio-grade MVP, not a prototype throwaway.
- Build for likely growth paths: more interview types, better reports, more users, safer runner isolation.
- Do not build FAANG-scale infrastructure unless there is a concrete pain point.
- Avoid introducing microservices, message buses, CQRS layers, or generic plugin systems unless the current monolith clearly cannot support the feature.

## Architecture Guardrails

- Keep a single product monolith:
  - `frontend/` for UI.
  - `backend/` for HTTP, WebSocket, authz, orchestration, and report generation.
  - `content/` for interview content.
  - `backend/supabase/migrations/` for schema.
- Treat code execution as a special isolation boundary.
  - All code execution must go through the runner path.
  - Never execute untrusted code in the main API process.
  - Prefer container or VM isolation over plain local process spawning when hardening this feature.
- Use a layered backend flow for non-trivial features:
  - `route` for HTTP concerns only.
  - `validator` for request parsing and authz preconditions.
  - `service` for business logic.
  - `repository` for Supabase access.
- Keep route files thin. If a route starts owning validation, authorization, DB joins, response shaping, retries, and side effects, split it.
- Frontend route components should orchestrate, not own every piece of state and view logic.
- Prefer feature folders over global utility dumping.

## Folder Conventions

- Frontend:
  - Keep route pages under `frontend/src/pages/<feature>/`.
  - Put reusable feature-local pieces in `components/`, `hooks/`, `api.ts`, and `types.ts`.
  - If a page exceeds roughly 250-300 lines, look for extraction.
  - If logic is shared by two or more pages, move it into a hook or helper.
- Backend:
  - Keep route registration in `backend/src/routes/`.
  - Add `services/` and `repositories/` folders when logic grows beyond simple CRUD.
  - Keep auth helpers in `middleware/` or a dedicated `authz/` module.
- Database:
  - Every schema change must go through a migration in order.
  - Migrations must work on a fresh database from scratch, not only on the current hosted environment.

## Naming Conventions

- Prefer explicit names over short names.
- Use `fetchX`, `createX`, `updateX`, `listX` for API/data functions.
- Use `loadX` only for read paths that hydrate UI state.
- Use `handleX` for UI event handlers only.
- Use `isX`, `hasX`, `canX` for booleans.
- Use domain names from the product:
  - `session`, `report`, `group`, `problem`, `snapshot`, `candidate`, `interviewer`.
- Avoid vague names like `data`, `item`, `stuff`, `util`, `helper` unless the scope is tiny and obvious.

## Frontend Patterns

- Prefer backend API access through `apiFetch` and typed feature APIs.
- Do not mix direct Supabase table access and backend API access for the same domain model.
  - Auth bootstrapping is the only acceptable exception until auth is centralized.
- Prefer one source of truth per page.
- Keep page components focused on:
  - routing,
  - high-level state,
  - composition.
- Extract repeated async state into hooks.
- Extract large editor/session panels into smaller presentational pieces.
- Prefer local state over global state until cross-route coordination is truly needed.
- Add clear loading, empty, and error states for every async page.
- Preserve accessibility:
  - label inputs,
  - keyboard reachable controls,
  - visible focus states,
  - semantic buttons and links.
- For preview/sandbox features:
  - prefer local bundled dependencies over CDN runtime dependencies,
  - keep sandbox boundaries explicit,
  - never trust preview code.

## Backend Patterns

- Validate request bodies at the edge.
  - Prefer schema validation such as Zod for new routes.
  - Return consistent `4xx` errors for invalid input.
- Centralize authorization checks.
  - Do not scatter participant/interviewer/candidate rules inline across many routes.
- Use consistent response shapes.
- Use a shared error-handling strategy instead of ad hoc `try/catch` duplication everywhere.
- Keep service-role Supabase usage narrowly scoped and reviewed carefully.
- Avoid hidden background side effects unless they are clearly documented and retriable.
- Any workflow that changes session state should be idempotent or guarded against double-submission/races.

## Database Rules

- Migration order must be valid on a clean environment.
- Add indexes only when they support real query patterns.
- Prefer explicit constraints over relying on UI behavior.
- Use database uniqueness for identity and concurrency safety.
- Backfills must tolerate empty tables and missing optional data.
- Keep naming consistent:
  - singular table names are acceptable here because they are already established,
  - keep column names descriptive and stable.
- If a route relies on a table for authz-critical behavior, the schema should make invalid states hard to represent.

## Security Rules

- Never trust the client for role, ownership, or session participation.
- Every backend route must answer:
  - who is allowed,
  - what resource they can touch,
  - what exact action is permitted.
- Because `supabaseAdmin` bypasses RLS, missing authz checks are high severity.
- Never put long-lived auth tokens in query params for new work.
- Never log secrets, bearer tokens, or sensitive payloads.
- Untrusted code execution must have:
  - resource limits,
  - filesystem isolation,
  - network isolation,
  - strict timeouts,
  - clear separation from the main API app.
- Prefer least privilege even in class-project scope.

## Testing Expectations

- High ROI tests only, but every critical path needs coverage.
- Minimum bar for new backend flows:
  - one happy-path integration test,
  - one auth/authorization test,
  - one invalid-input test.
- Minimum bar for session/report logic:
  - join flow,
  - interviewer-only actions,
  - report generation permissions,
  - session completion behavior.
- Minimum bar for frontend:
  - one smoke test for auth redirect/layout guards,
  - one test for session flow UI states,
  - one test for a core form or async page.
- Broken lint or test commands are treated as real defects.

## Code Review Standards

- Review for correctness first, then security, then maintainability.
- Call out:
  - authz gaps,
  - race conditions,
  - giant components,
  - mixed concerns,
  - duplicated async handling,
  - stale comments and docs.
- New code should be understandable without reading the entire repo.
- If a change adds complexity, it must also add clarity.

## Performance Guardrails

- Code-split heavyweight editor/session experiences.
- Watch bundle size for the interview/session route specifically.
- Avoid refetching the same data through multiple paths in one page.
- Prefer manifest-driven content loading over shipping giant hard-coded client catalogues when practical.
- Debounce or batch expensive preview work.
- Do not optimize speculative scale issues before fixing obvious user-facing slowness.

## Refactor Heuristics

- Refactor when:
  - a file becomes hard to review in one screen,
  - logic is copied twice,
  - authz rules are duplicated,
  - a component mixes data fetching, orchestration, and rendering heavily,
  - a route mixes validation, authz, queries, and domain logic.
- Do not refactor purely for aesthetic abstraction.
- Extract the smallest stable boundary that makes the next change easier.

## What Not To Do

- Do not add a new direct Supabase query in the frontend for a domain already served by backend endpoints.
- Do not add more giant page files when a hook or subcomponent is the real need.
- Do not rely on UI-only protections for interviewer-only or candidate-only behavior.
- Do not assume service-role access is safe just because the route is authenticated.
- Do not add new migrations that depend on out-of-band manual DB setup.
- Do not add placeholder scripts or commands that fail in normal use.
- Do not introduce generic abstraction layers with one call site.

## Simplicity Rules

- Prefer a well-structured monolith over a distributed system.
- Prefer explicit branching over abstract strategy layers when only 2-4 cases exist.
- Prefer typed plain objects over class hierarchies.
- Prefer one good helper over a generic framework.
- Prefer clear duplication over wrong abstraction until patterns stabilize.

## Class-Project Tradeoff Rules

- Choose fixes that improve demo confidence and recruiter signal first.
- Lightweight validation, tests, linting, and authz improvements are worth it.
- Full observability stacks, complex infra automation, and deep platform work are not required yet.
- If a safeguard prevents a likely bug or embarrassing demo failure, it is in scope.
- If a feature only matters at large-company scale and adds maintenance burden now, defer it.

## Ship Fast But Clean

- Make the next safe change easy.
- Leave breadcrumbs:
  - strong names,
  - short comments where needed,
  - predictable file placement,
  - working scripts.
- Favor code that helps the next reviewer say:
  - "I trust this,"
  - "I can extend this,"
  - "This team knew what they were doing."
