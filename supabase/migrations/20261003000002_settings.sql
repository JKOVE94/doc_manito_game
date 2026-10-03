-- 앱 설정 (관리자 비밀번호 해시, 세션 서명 키 등). service_role 전용
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;
