-- 자리비움 기록 (미션 마감 유예 계산용). ended_at null = 현재 자리비움 중
create table if not exists public.away_periods (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  set_by          text not null default 'SELF' check (set_by in ('SELF','ADMIN'))
);
create unique index if not exists away_periods_one_open on public.away_periods (participant_id) where ended_at is null;
create index if not exists away_periods_session_idx on public.away_periods (session_id, participant_id);
alter table public.away_periods enable row level security;
