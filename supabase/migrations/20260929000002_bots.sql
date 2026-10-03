-- 테스트 모드: 봇 참가자 표시
alter table public.participants add column if not exists is_bot boolean not null default false;
