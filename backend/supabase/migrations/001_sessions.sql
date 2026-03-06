-- ═══════════════════════════════════════════════════════════
--  Interview Sessions schema
-- ═══════════════════════════════════════════════════════════

-- Possible session states:
--   waiting   → interviewer created, candidate not yet joined
--   active    → both participants present, interview in progress
--   completed → interview finished (all questions done or manually ended)
--   cancelled → session was cancelled before completion

create type session_status as enum ('waiting', 'active', 'completed', 'cancelled');

-- ── Sessions table ────────────────────────────────────────
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  join_code     text unique not null,
  interviewer_id uuid not null references auth.users(id) on delete cascade,
  candidate_id  uuid references auth.users(id) on delete set null,
  status        session_status not null default 'waiting',
  current_index int not null default 0,         -- index into session_problems
  created_at    timestamptz not null default now(),
  started_at    timestamptz,                    -- when candidate joined
  ended_at      timestamptz
);

-- ── Problems within a session (ordered) ───────────────────
create table if not exists session_problems (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  problem_id   text not null,                   -- slug from content JSON
  category     text not null,                   -- 'frontend' | 'leetcode'
  time_limit   int not null default 30,         -- minutes
  order_index  int not null,                    -- 0-based position
  locked       boolean not null default false,  -- true when timer expired
  unique(session_id, order_index)
);

-- ── Indexes ───────────────────────────────────────────────
create index idx_sessions_join_code on sessions(join_code);
create index idx_sessions_interviewer on sessions(interviewer_id);
create index idx_session_problems_session on session_problems(session_id);

-- ── Row Level Security ────────────────────────────────────
alter table sessions enable row level security;
alter table session_problems enable row level security;

-- Interviewers can see sessions they created
create policy "Interviewer can manage own sessions"
  on sessions for all
  using (auth.uid() = interviewer_id);

-- Candidates can see sessions they joined
create policy "Candidate can view joined sessions"
  on sessions for select
  using (auth.uid() = candidate_id);

-- Candidates can update sessions they joined (for joining)
create policy "Candidate can update joined sessions"
  on sessions for update
  using (auth.uid() = candidate_id or candidate_id is null);

-- Anyone in a session can view its problems
create policy "Session participants can view problems"
  on session_problems for select
  using (
    exists (
      select 1 from sessions s
      where s.id = session_problems.session_id
        and (s.interviewer_id = auth.uid() or s.candidate_id = auth.uid())
    )
  );

-- Interviewers can manage session problems
create policy "Interviewer can manage session problems"
  on session_problems for all
  using (
    exists (
      select 1 from sessions s
      where s.id = session_problems.session_id
        and s.interviewer_id = auth.uid()
    )
  );

-- ── Enable Realtime ───────────────────────────────────────
alter publication supabase_realtime add table sessions;
