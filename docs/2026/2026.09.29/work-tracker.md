# Work Tracker — 대현목장 시크릿 마니또 플랫폼

- **목적**: 10/3 마니또 파티용 모바일 퍼스트 웹앱 (마니또 매칭·키워드 해금 미션·거짓/진실 게임·시크릿 히틀러 배팅·엔딩 공개)
- **작성일**: 2026-09-29
- **상태**: ✅ 구현 완료 — 배포 및 실제 Gemini 키 리허설 대기
- **배포**: Vercel (Next.js 16 App Router) + Supabase (Postgres + Realtime)
- **D-day**: 2026-10-03 (리허설 권장: 10/2)

## 1. 아키텍처 결정 (ADR 요약)

| # | 결정 | 이유 |
|---|------|------|
| A1 | **모든 데이터 접근은 서버(Route Handler) + service_role 키** 로만. 테이블 RLS ON / 정책 없음 | 마니또 매칭·키워드 원문이 클라이언트 쿼리로 새는 것을 원천 차단 |
| A2 | 실시간 동기화 = `game_sessions.revision` 변경을 **Supabase Realtime 신호**로 구독 → 개인화 상태는 `/api/me/state` 재조회. 5초 폴링 fallback | 비밀 데이터 노출 없이 실시간성 확보, 신호 누락에도 자가 복구 |
| A3 | 인증 = 이름 + 4자리 PIN (scrypt 해시) → HMAC 서명 httpOnly 쿠키. 관리자는 `ADMIN_PASSWORD` 환경변수 | 파티 현장 즉시 입장, 회원가입 불필요 |
| A4 | 단일 세션 운영 (`game_sessions.code='main'`). 관리자 "리셋"으로 리허설 후 초기화 | YAGNI — 파티 1회용 |
| A5 | 순환 매칭 = 무작위 순열 후 `p[i] → p[(i+1)%n]` | n≥4 에서 항상 단일 해밀턴 사이클, 2-사이클 불가능 (증명 자명) |
| A6 | 타이머 = 서버 `tl_ends_at` 저장, 클라이언트는 서버시각 오프셋 보정 카운트다운. 만료는 조회 시점에 lazy 판정 → 자동 공개 | 크론 불필요, 기기 시계 오차 무관 |
| A7 | 키워드 해금 = 누적 **승인** 미션 수 기준 `[1, 3, 5]` (src/lib/config.ts) + 관리자 수동 조정 | 8미션 중 첫 미션부터 보상, 후반 긴장감 유지 |
| A9 | AI 힌트 = Gemini `generateContent` + JSON 스키마 출력. 모델에는 **익명 닉네임 + 키워드 3개(🔓/🔒 표시)만** 전달, 실명·ID 미전달. 잠긴 키워드/초성 노출 답변은 서버 필터로 가리고 기회 미차감. 쿼터 = 3 + 승인 미션 수 | 프롬프트 인젝션에도 이름 유출 불가(모델이 모름), 키워드 유출은 2중 방어 |
| A8 | 조커 퀴즈 = 미해금 키워드 1개 정답 + 다른 참가자의 같은 슬롯 키워드 3개 오답. 문제는 DB 에 고정 저장(새로고침 리롤 방지), 정답 인덱스는 클라이언트 비노출 | 1회성 보장 + 치팅 방지 |

## 2. 착수 로드맵

| # | 단계 | 작업 내용 | 파일 | 담당 | 상태 | 비고 |
|---|------|----------|------|------|------|------|
| 1 | 설계 | 기획 분석, ADR, 트래커 | `docs/2026/2026.09.29/*` | Claude | ✅ | |
| 2 | 설계 | DB 스키마 + RLS + Realtime | `supabase/schema.sql` | Claude | ✅ | |
| 3 | 설계 | API 계약 (타입/엔드포인트) | `src/lib/types.ts`, `api-contract.md` | Claude | ✅ | |
| 4 | 기반 | 클라이언트 fetch/실시간 훅 | `src/lib/client/*` | Claude | ✅ | |
| 5 | 유틸 | 초성 추출·순환 셔플·퀴즈 보기·익명 닉네임 | `src/lib/game/{choseong,cycle,quiz,alias}.ts` | Local LLM | ✅ | cycle/alias 원본 채택. choseong(`string.some` 타입오류·빈문자열), quiz(대소문자 변형·export 누락) PM 수정 |
| 6 | 서버 | 인증·세션·게임 서비스·전체 API (22 routes) | `src/lib/server/*`, `src/app/api/**` | Claude | ✅ | tsc/eslint 통과 |
| 7 | UI | 입장/관리자 콘솔 | `src/app/page.tsx`, `src/app/admin/**` | Antigravity | ✅ | 계약 준수 검수 완료 |
| 8 | UI | 참가자 대시보드·조커 모달·타이머·엔딩 링 시각화 | `src/app/play/**`, `src/components/play/**` | ~~Cursor~~ → Antigravity | ✅ | Cursor CLI 비대화 모드 인증 실패 → 재할당. 360px 스크린샷 검수 완료 |
| 9 | 검증 | 유닛 16건, E2E 스모크(실제 API 풀게임+AI 목), RLS 확인, 360px 헤드리스 스크린샷, `next build` | `src/lib/game/game.test.ts`, `scripts/smoke.mjs` | Claude | ✅ | 검수 중 호스트 콘솔 거짓말 순번 기본 노출 → 기본 가림으로 수정 |
| 9a | AI | AI 스무고개 힌트 백엔드 (Gemini, 유출 방지 2중 방어, 질문 쿼터) | `src/lib/server/{ask,gemini}.ts`, `src/lib/game/leak.ts`, `/api/me/ask` | Claude | ✅ | 목 서버로 E2E 검증 |
| 9b | AI | AI 스무고개 채팅 패널 UI | `src/components/play/AskPanel.tsx` | Antigravity | ✅ | 검수 완료 |
| 10 | 배포 | Supabase 스키마 적용, Vercel env 설정, 리허설 | README | 사용자 + Claude | ⏳ | |

## 3. 게임 진행 상태 머신

```
READY ──(관리자 start: 참가자≥4, 셔플)──▶ ACTIVE ──(guessing)──▶ GUESSING ──(finish)──▶ FINISHED
  ▲                                                                                     │
  └──────────────────────────────── reset (리허설 초기화) ◀──────────────────────────────┘

거짓·진실 타이머: IDLE ─start─▶ RUNNING ⇄ PAUSED ─(만료|end)─▶ ENDED(=자동 공개)
배팅: OPEN ─lock─▶ LOCKED ─result(승리진영)─▶ RESULT
```

## 4. 리스크

| 리스크 | 대응 |
|--------|------|
| 현장 와이파이 불안정 | 폴링 fallback + visibilitychange 재조회 |
| 참가자 PIN 분실 | 관리자 화면에서 참가자 삭제(READY) 후 재가입 / ACTIVE 이후엔 PIN 재설정 없음 → 입장 시 안내 |
| 셔플 중복 클릭 | `status='READY'` 조건부 업데이트로 원자적 선점 |
| 키워드 미입력자 | 시작 시 누락자 목록 경고, `force` 옵션으로 강행 가능 |
