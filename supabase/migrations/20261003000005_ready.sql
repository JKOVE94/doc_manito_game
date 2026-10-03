-- 준비 완료 (게임 시작 전 참가자가 키워드 입력 후 [준비] 버튼)
alter table public.participants add column if not exists is_ready boolean not null default false;
