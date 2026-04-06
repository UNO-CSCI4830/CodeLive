-- Keep per-question timer state authoritative on the session row.
alter table sessions
  add column if not exists current_question_started_at timestamptz;

update sessions
set current_question_started_at = coalesce(current_question_started_at, started_at, created_at)
where current_question_started_at is null;

alter table sessions
  alter column current_question_started_at set default now();

alter table sessions
  alter column current_question_started_at set not null;

-- Ensure realtime updates for lock state land without polling fallback.
do $$
begin
  alter publication supabase_realtime add table session_problems;
exception
  when duplicate_object then null;
end $$;
