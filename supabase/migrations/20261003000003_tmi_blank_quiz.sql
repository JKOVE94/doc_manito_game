-- 빈칸 퀴즈: TMI 에 Notion 퀴즈(문제·정답·오답 3개) 저장, 출제된 퀴즈 유형 기록
alter table public.tmi_facts   add column if not exists quiz jsonb;          -- { question, answer, decoys[3] }
alter table public.tmi_quizzes add column if not exists kind text not null default 'WHO';
alter table public.tmi_quizzes drop constraint if exists tmi_quizzes_kind_check;
alter table public.tmi_quizzes add constraint tmi_quizzes_kind_check check (kind in ('WHO','BLANK'));
alter table public.tmi_quizzes add column if not exists subject text;        -- 빈칸 퀴즈의 주인공 이름
