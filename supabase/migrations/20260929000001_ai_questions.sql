-- AI 스무고개 힌트: 참가자가 자연어로 타깃에 대해 질문 → Gemini 답변 기록
create table if not exists public.ai_questions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  question        text not null,
  verdict         text not null check (verdict in ('YES','NO','PARTLY','UNKNOWN')),
  answer          text not null,
  created_at      timestamptz not null default now()
);
create index if not exists ai_questions_participant_idx on public.ai_questions (participant_id, created_at);
alter table public.ai_questions enable row level security;
