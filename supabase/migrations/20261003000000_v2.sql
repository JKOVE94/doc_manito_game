-- =====================================================================
-- v2 (2026-10-03): 두 관계 구조 · 수시 TMI 퀴즈 · 질문 우편함 · 미션 사진 인증
-- 재실행 안전 (if not exists / on conflict)
-- =====================================================================

-- 힌트 단계 0~5 (키워드 3 + 이름 글자 수 + 이름 초성)
-- manito_chains(giver→receiver) 의 unlocked_level/hint_*/final_guess_* 는
-- 이제 "receiver 가 giver(비밀 마니또)에 대해 알아낸 상태" 를 뜻함
alter table public.manito_chains drop constraint if exists manito_chains_unlocked_level_check;
alter table public.manito_chains add constraint manito_chains_unlocked_level_check
  check (unlocked_level between 0 and 5);

-- 미션 사진 인증 (Supabase Storage 비공개 버킷 경로)
alter table public.mission_submissions add column if not exists photo_path text;

-- 퀴즈 스케줄 (참가자별 다음 퀴즈 시각, 서버가 조회 시점에 lazy 생성)
alter table public.participants add column if not exists next_quiz_at timestamptz;

-- AI 스무고개 대상 구분
alter table public.ai_questions add column if not exists about text not null default 'MANITO';
alter table public.ai_questions drop constraint if exists ai_questions_about_check;
alter table public.ai_questions add constraint ai_questions_about_check check (about in ('TARGET','MANITO'));

-- Notion TMI (퀴즈·AI 스무고개 데이터)
create table if not exists public.tmi_facts (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.game_sessions(id) on delete cascade,
  subject_name  text not null,
  fact          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists tmi_facts_session_idx on public.tmi_facts (session_id, subject_name);

-- 수시 TMI 퀴즈
create table if not exists public.tmi_quizzes (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  fact_id         uuid references public.tmi_facts(id) on delete set null,
  question        text not null,
  options         jsonb not null,
  answer_index    int  not null check (answer_index between 0 and 3),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  answered_at     timestamptz,
  chosen_index    int,
  is_correct      boolean
);
-- 참가자당 미응답 퀴즈는 1개만 (동시 조회 시 중복 생성 방지)
create unique index if not exists tmi_quizzes_one_pending
  on public.tmi_quizzes (participant_id) where answered_at is null;
create index if not exists tmi_quizzes_session_idx on public.tmi_quizzes (session_id, participant_id);

-- 질문 우편함 (giver→receiver 체인 단위)
--   TO_TARGET : giver 가 receiver 에게 (receiver 는 보낸 사람 모름)
--   TO_MANITO : receiver 가 giver 에게 (giver 는 보낸 사람 앎)
create table if not exists public.mails (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.game_sessions(id) on delete cascade,
  chain_id     uuid not null references public.manito_chains(id) on delete cascade,
  direction    text not null check (direction in ('TO_TARGET','TO_MANITO')),
  question     text not null check (char_length(question) between 1 and 200),
  answer       text check (char_length(answer) between 1 and 300),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);
create index if not exists mails_chain_idx on public.mails (chain_id, direction);

alter table public.tmi_facts   enable row level security;
alter table public.tmi_quizzes enable row level security;
alter table public.mails       enable row level security;

-- 미션 사진 버킷 (비공개, 10MB, 이미지만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mission-photos', 'mission-photos', false, 10485760, array['image/*'])
on conflict (id) do nothing;
