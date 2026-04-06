-- Shared interview timer + report-friendly candidate display name.
alter table sessions
  add column if not exists total_time_limit_minutes int;

update sessions s
set total_time_limit_minutes = coalesce(
  (
    select sum(sp.time_limit)
    from session_problems sp
    where sp.session_id = s.id
  ),
  0
)
where s.total_time_limit_minutes is null;

alter table sessions
  alter column total_time_limit_minutes set default 0;

alter table sessions
  alter column total_time_limit_minutes set not null;

alter table sessions
  add column if not exists timer_paused boolean not null default false,
  add column if not exists timer_paused_at timestamptz,
  add column if not exists timer_paused_seconds int not null default 0,
  add column if not exists candidate_name text;

-- Backfill candidate display names for existing sessions.
update sessions s
set candidate_name = coalesce(nullif(trim(p.name), ''), 'Candidate')
from profiles p
where s.candidate_id = p.id
  and (s.candidate_name is null or trim(s.candidate_name) = '');

update sessions
set candidate_name = 'Candidate'
where candidate_id is not null
  and (candidate_name is null or trim(candidate_name) = '');
