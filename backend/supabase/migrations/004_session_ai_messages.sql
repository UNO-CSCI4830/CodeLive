-- Persist per-problem AI chat messages during active interviews.
create table if not exists session_ai_messages (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  order_index      int not null,
  problem_id       text not null,
  message_id       text not null,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  sent_by_user_id  uuid references auth.users(id) on delete set null,
  occurred_at      timestamptz not null,
  created_at       timestamptz not null default now(),
  unique (session_id, message_id)
);

create index if not exists idx_session_ai_messages_session_order_time
  on session_ai_messages(session_id, order_index, occurred_at, created_at);

alter table session_ai_messages enable row level security;

create policy "Session participants can view AI messages"
  on session_ai_messages for select
  using (
    exists (
      select 1 from sessions s
      where s.id = session_ai_messages.session_id
        and (s.interviewer_id = auth.uid() or s.candidate_id = auth.uid())
    )
  );

create policy "Candidate can insert AI messages"
  on session_ai_messages for insert
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_ai_messages.session_id
        and s.candidate_id = auth.uid()
    )
  );

create policy "Interviewer can manage AI messages"
  on session_ai_messages for all
  using (
    exists (
      select 1 from sessions s
      where s.id = session_ai_messages.session_id
        and s.interviewer_id = auth.uid()
    )
  );
