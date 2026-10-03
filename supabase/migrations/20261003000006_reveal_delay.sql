-- 거짓·진실 게임: 타이머 종료 후 일정 시간 뒤 순번 자동 공개
alter table public.game_sessions add column if not exists tl_reveal_at timestamptz;
