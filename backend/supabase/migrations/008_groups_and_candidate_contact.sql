-- Interviewer-defined groups and extra candidate metadata on sessions.

create table if not exists interviewer_groups (
  id             uuid primary key default gen_random_uuid(),
  interviewer_id uuid not null references auth.users(id) on delete cascade,
  job_role       text not null,
  job_number     text,
  created_at     timestamptz not null default now()
);

create unique index if not exists idx_interviewer_groups_unique_name
  on interviewer_groups(
    interviewer_id,
    lower(trim(job_role)),
    coalesce(lower(trim(job_number)), '')
  );

create index if not exists idx_interviewer_groups_owner
  on interviewer_groups(interviewer_id, created_at desc);

alter table interviewer_groups enable row level security;

create policy "Interviewer can manage own groups"
  on interviewer_groups for all
  using (auth.uid() = interviewer_id)
  with check (auth.uid() = interviewer_id);

alter table sessions
  add column if not exists group_id uuid references interviewer_groups(id) on delete set null,
  add column if not exists candidate_last_name text,
  add column if not exists candidate_email text;

create index if not exists idx_sessions_group_id
  on sessions(group_id);

-- Backfill candidate_last_name from existing candidate_name when available.
update sessions
set candidate_last_name = nullif(trim(regexp_replace(candidate_name, '^.*\\s', '')), '')
where (candidate_last_name is null or trim(candidate_last_name) = '')
  and candidate_name is not null
  and trim(candidate_name) <> ''
  and candidate_name ~ '\\s';
