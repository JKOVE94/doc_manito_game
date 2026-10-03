-- 미션 랜덤 자동 오픈 스케줄 (세션 단위)
alter table public.game_sessions add column if not exists mission_auto boolean not null default true;
alter table public.game_sessions add column if not exists next_mission_at timestamptz;
