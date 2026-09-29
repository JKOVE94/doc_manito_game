# task-antigravity.md — 입장 화면 + 관리자(호스트) 콘솔

너는 Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript 프로젝트의 프론트엔드 개발자다.
프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. **먼저 아래 파일을 모두 읽어라**:
- `AGENTS.md` (Next.js 16 은 학습 데이터와 다르다 — 필요 시 `node_modules/next/dist/docs/` 확인)
- `docs/2026/2026.09.29/work-tracker.md`, `docs/2026/2026.09.29/api-contract.md`
- `src/lib/types.ts` (응답 타입 — **유일한 진실의 원천**, 특히 `AdminState`)
- `src/lib/client/api.ts`, `src/lib/client/useLiveState.ts`
- `src/components/ui/index.tsx` (공용 UI — 반드시 재사용), `src/app/globals.css`

## 목표
(1) 참가자 입장 화면 `/`, (2) 사회자용 관리자 콘솔 `/admin` 구현. 백엔드 API 는 PM 이 동시에 구현 중 — 계약만 믿고 작성.

## 파일 소유권 (이 파일들만 생성/수정 가능)
- `src/app/page.tsx`
- `src/app/admin/**`
- `src/components/admin/**`
- 그 외 파일(`package.json`, `src/lib/**`, `src/app/api/**`, `src/app/play/**`, `src/components/play/**`, `src/components/ui/**`, `src/app/layout.tsx`)은 **절대 수정 금지**. 필요한 게 있으면 보고서에 "요청 사항"으로.
- `npm install`, `next build`, `next dev` 실행 금지. 검증은 `npx tsc --noEmit -p .` 와 `npx eslint src/app/page.tsx src/app/admin src/components/admin` 만. (다른 사람 파일 에러는 무시)

## 화면 명세

### 1) `/` 입장 (client component)
- 타이틀 "대현목장 시크릿 마니또 🎁", 파티 날짜 10월 3일.
- 폼: 이름(1~20자), PIN 4자리 (`inputMode="numeric"`, `pattern="\d{4}"`, maxLength 4, password 마스킹).
  안내 문구: "처음이면 새로 등록, 이미 등록했다면 같은 이름+PIN으로 다시 입장해요. PIN은 잊지 마세요!"
- 제출 → `POST /api/auth/join` → 성공 시 `router.push("/play")`. 실패 메시지 `ErrorText`.
- 마운트 시 `api("/api/me/state")` 가 성공하면 이미 로그인 상태 → `/play` 로 이동.
- 하단 작은 링크 "호스트 콘솔" → `/admin`.

### 2) `/admin` 관리자 콘솔 (client component, 모바일에서도 사용 가능하되 데스크톱에선 2열 그리드)
- `useLiveState<AdminState>("/api/admin/state")`. `error.status === 401` 이면 비밀번호 로그인 폼 → `POST /api/admin/login` → `refresh()`. 로그아웃 버튼.
- 섹션 (각각 `src/components/admin/*.tsx` 로 분리):
  1. **SessionControl**: 상태 배지, 참가자 수 / 최소 인원, "마니또 셔플 & 게임 시작" 버튼 (`canStart` false 면 비활성 + 사유). `POST /api/admin/session {action:'start'}` → 409 응답 시 `ApiRequestError.message` 표시 + "그래도 시작" 버튼(`force: true`). 단계 전환 버튼: ACTIVE→"최종 추리 오픈"(`guessing`), GUESSING→"결과 공개"(`finish`), GUESSING/FINISHED→"진행중으로 되돌리기"(`back-to-active`).
  2. **ParticipantTable**: 이름, 익명닉네임, 키워드 n/3, 거짓순번 입력여부(✔만, 숫자는 숨김 토글), 배팅/추리 제출 여부. READY 에서 "삭제" (인라인 2단계 확인) → `/api/admin/participant/remove`.
  3. **TruthLieController**: 분 입력(기본 15) + 시작, 일시정지/재개, 종료, 리셋, "전원 거짓말 순번 공개"/"가리기". 큰 카운트다운 (`remainingSeconds(timer, clockOffsetMs)` 250ms 갱신). 공개 테이블(`truthLie.reveal`: 이름 + 순번).
  4. **MissionManager**: 8개 슬롯 카드 — 제목/설명 편집 저장(`mission/save`), 진행 시간(분, 기본 60) 입력 + "오픈"(`mission/open`), "즉시 마감"(`mission/close`). 상태 표시: 미오픈 / 진행중(마감까지 카운트다운) / 마감.
     빈 슬롯 제목 placeholder 예: "마니또에게 응원 쪽지 남기기".
  5. **SubmissionReview**: 제출 목록 (PENDING 우선 정렬, 필터 탭 전체/대기/승인/반려). 각 행: 미션 #slot 제목, 참가자 이름, 메모, 시각, 승인/반려/대기로 되돌리기 버튼 → `submission/review`.
  6. **ChainBoard** (ACTIVE 이후): position 순 `giver → receiver(alias)`, 해금 레벨 0~3 −/+ 버튼(`chain/unlock`), 승인 미션 수, 조커 사용/정답, 최종 추리 결과. 스포일러 방지를 위해 **기본 접힘 + "매칭 보기" 토글**.
  7. **BetController**: 상태(OPEN/LOCKED/RESULT), 잠금/열기, 승리 진영 선택 후 "결과 발표"(`bet {action:'result', winningFaction}`), 행 목록(이름, 진영, 예측, 적중).
  8. **DangerZone**: 리셋 — "참가자 유지" 체크박스(keepParticipants), 입력창에 `RESET` 타이핑해야 버튼 활성 → `session {action:'reset', confirm:'RESET', keepParticipants}`.

## 품질 기준
- 360px 폭 가로 스크롤 없음. 터치 타깃 ≥ 44px.
- 모든 액션: loading 상태, 실패 시 `ErrorText`, 성공 시 `await refresh()`.
- `window.alert/confirm/prompt` 금지 (인라인 확인 UI).
- 외부 라이브러리 추가 금지.

## 완료 보고
작업 끝나면 `docs/2026/2026.09.29/report-antigravity.md` 에 생성 파일 목록, tsc/eslint 결과, 요청 사항을 적어라.
