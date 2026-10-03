-- =====================================================================
-- 대현목장 시크릿 마니또 — Supabase schema
-- Supabase Dashboard > SQL Editor 에 전체 붙여넣고 실행하세요. (재실행 안전)
--
-- 보안 모델
--   * 모든 테이블 RLS ON + 정책 없음 → anon/authenticated 키로는 접근 불가.
--   * 서버(Next.js Route Handler)만 service_role 키로 읽고 씀.
--   * 예외: game_sessions 는 비밀 정보가 없으므로 anon SELECT 허용 →
--     클라이언트가 Realtime 으로 "변경 신호(revision)"만 구독하고,
--     실제 개인화 데이터는 서버 API 로 다시 가져옴.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- (2) Game_Sessions : 파티 세션 (단일 행 운영: code = 'main')
-- ---------------------------------------------------------------------
create table if not exists public.game_sessions (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default 'main',
  status            text not null default 'READY'
                    check (status in ('READY','ACTIVE','GUESSING','FINISHED')),
  -- 변경 신호: 어떤 데이터든 바뀌면 +1 → 클라이언트 재조회 트리거
  revision          bigint not null default 0,
  -- 거짓·진실 게임 타이머
  tl_status         text not null default 'IDLE'
                    check (tl_status in ('IDLE','RUNNING','PAUSED','ENDED')),
  tl_duration_sec   int  not null default 900,
  tl_ends_at        timestamptz,
  tl_remaining_sec  int,
  tl_revealed       boolean not null default false,
  -- 시크릿 히틀러 배팅
  bet_status        text not null default 'OPEN'
                    check (bet_status in ('OPEN','LOCKED','RESULT')),
  winning_faction   text check (winning_faction in ('LIBERAL','FASCIST')),
  started_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- (1) Users → participants : 참가자 (관리자는 환경변수 비밀번호로 별도 인증)
-- ---------------------------------------------------------------------
create table if not exists public.participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.game_sessions(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  pin_hash    text not null,
  alias       text,                                  -- 익명 닉네임 (셔플 시 부여)
  role        text not null default 'MEMBER' check (role in ('ADMIN','MEMBER')),
  failed_pin_attempts int not null default 0,        -- PIN 무차별 대입 방지
  locked_until        timestamptz,
  created_at  timestamptz not null default now(),
  unique (session_id, name)
);
-- 테스트 모드 봇 표시 (기존 DB 에도 적용되도록 alter 로 추가)
alter table public.participants add column if not exists is_bot boolean not null default false;

-- ---------------------------------------------------------------------
-- (4) User_Keywords : TMI 키워드 3종
--     공개 여부는 manito_chains.unlocked_level 로 계산 (slot_index <= level)
-- ---------------------------------------------------------------------
create table if not exists public.user_keywords (
  id                  uuid primary key default gen_random_uuid(),
  participant_id      uuid not null references public.participants(id) on delete cascade,
  slot_index          int  not null check (slot_index between 1 and 3),
  keyword_value       text not null check (char_length(keyword_value) between 1 and 30),
  initial_consonants  text not null,
  created_at          timestamptz not null default now(),
  unique (participant_id, slot_index)
);

-- ---------------------------------------------------------------------
-- (3) Manito_Chains : 단일 순환 매칭 (giver → receiver)
-- ---------------------------------------------------------------------
create table if not exists public.manito_chains (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.game_sessions(id) on delete cascade,
  position             int  not null,               -- 순환 고리 내 순서 (시각화용)
  giver_id             uuid not null references public.participants(id) on delete cascade,
  receiver_id          uuid not null references public.participants(id) on delete cascade,
  unlocked_level       int  not null default 0 check (unlocked_level between 0 and 3),
  unlock_bonus         int  not null default 0,     -- 관리자 수동 보정치 (level = clamp(승인기반 + bonus))
  -- 조커 찬스
  hint_used            boolean not null default false,
  hint_slot            int check (hint_slot between 1 and 3),
  hint_quiz            jsonb,                        -- { question, options[4], answerIndex }
  hint_solved          boolean,
  -- 히든 퀘스트 (시크릿 히틀러)
  hidden_quest         text,
  -- 최종 추리
  final_guess_id       uuid references public.participants(id) on delete set null,
  is_guess_correct     boolean,
  created_at           timestamptz not null default now(),
  unique (session_id, giver_id),
  unique (session_id, receiver_id)
);

-- ---------------------------------------------------------------------
-- (5) Truth_Lie_Settings : 거짓말 순번 (공개 여부는 game_sessions.tl_revealed)
-- ---------------------------------------------------------------------
create table if not exists public.truth_lie_settings (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  lie_turn        int  not null check (lie_turn between 1 and 4),
  updated_at      timestamptz not null default now(),
  unique (session_id, participant_id)
);

-- ---------------------------------------------------------------------
-- (6) Hourly_Missions : 시간제 미션 8슬롯 + 제출/승인
-- ---------------------------------------------------------------------
create table if not exists public.hourly_missions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.game_sessions(id) on delete cascade,
  hour_slot     int  not null check (hour_slot between 1 and 8),
  title         text not null,
  description   text not null default '',
  opened_at     timestamptz,                         -- null = 아직 미오픈
  deadline_time timestamptz,
  unique (session_id, hour_slot)
);

create table if not exists public.mission_submissions (
  id              uuid primary key default gen_random_uuid(),
  mission_id      uuid not null references public.hourly_missions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  note            text not null default '',
  status          text not null default 'PENDING'
                  check (status in ('PENDING','APPROVED','REJECTED')),
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  unique (mission_id, participant_id)
);

-- ---------------------------------------------------------------------
-- 레크레이션 2 : 시크릿 히틀러 진영 배팅
-- ---------------------------------------------------------------------
create table if not exists public.faction_bets (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.game_sessions(id) on delete cascade,
  participant_id  uuid not null references public.participants(id) on delete cascade,
  faction         text not null check (faction in ('LIBERAL','FASCIST')),
  prediction      text not null check (prediction in ('WIN','LOSE')),
  updated_at      timestamptz not null default now(),
  unique (session_id, participant_id)
);

-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 변경 신호 원자적 증가 (service_role 전용)
-- ---------------------------------------------------------------------
create or replace function public.bump_revision(p_session uuid)
returns void language sql security definer set search_path = public as $$
  update public.game_sessions
     set revision = revision + 1, updated_at = now()
   where id = p_session;
$$;
revoke all on function public.bump_revision(uuid) from public, anon, authenticated;
grant execute on function public.bump_revision(uuid) to service_role;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.game_sessions       enable row level security;
alter table public.participants        enable row level security;
alter table public.user_keywords       enable row level security;
alter table public.manito_chains       enable row level security;
alter table public.truth_lie_settings  enable row level security;
alter table public.hourly_missions     enable row level security;
alter table public.mission_submissions enable row level security;
alter table public.faction_bets        enable row level security;
alter table public.ai_questions        enable row level security;

drop policy if exists "public read session signal" on public.game_sessions;
create policy "public read session signal" on public.game_sessions
  for select to anon, authenticated using (true);

-- Realtime: game_sessions 변경 브로드캐스트
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions'
  ) then
    alter publication supabase_realtime add table public.game_sessions;
  end if;
end $$;

-- 기본 세션 행
insert into public.game_sessions (code) values ('main') on conflict (code) do nothing;

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

-- 앱 설정 (관리자 비밀번호 해시, 세션 서명 키 등). service_role 전용
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- 빈칸 퀴즈: TMI 에 Notion 퀴즈(문제·정답·오답 3개) 저장, 출제된 퀴즈 유형 기록
alter table public.tmi_facts   add column if not exists quiz jsonb;          -- { question, answer, decoys[3] }
alter table public.tmi_quizzes add column if not exists kind text not null default 'WHO';
alter table public.tmi_quizzes drop constraint if exists tmi_quizzes_kind_check;
alter table public.tmi_quizzes add constraint tmi_quizzes_kind_check check (kind in ('WHO','BLANK'));
alter table public.tmi_quizzes add column if not exists subject text;        -- 빈칸 퀴즈의 주인공 이름
