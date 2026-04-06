-- Add AI assistant session controls.
alter table sessions
  add column if not exists ai_enabled boolean not null default true;
