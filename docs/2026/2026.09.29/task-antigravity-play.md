# task-cursor.md — 참가자 게임 화면 (고난도 UI)

너는 Next.js 16 (App Router) + React 19 + Tailwind v4 + TypeScript 프로젝트의 프론트엔드 개발자다.
프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. **먼저 아래 파일을 모두 읽어라**:
- `AGENTS.md` (Next.js 16 은 학습 데이터와 다르다 — 필요 시 `node_modules/next/dist/docs/` 확인)
- `docs/2026/2026.09.29/work-tracker.md` (기획/아키텍처)
- `docs/2026/2026.09.29/api-contract.md` (API 목록)
- `src/lib/types.ts` (응답 타입 — **유일한 진실의 원천**)
- `src/lib/client/api.ts`, `src/lib/client/useLiveState.ts` (호출/실시간 훅)
- `src/components/ui/index.tsx` (공용 UI — 반드시 재사용), `src/app/globals.css` (테마 토큰)

## 목표
대현목장 마니또 파티 참가자용 모바일 퍼스트 게임 화면 `/play` 를 구현한다. (백엔드 API 는 PM 이 동시에 구현 중이므로 네 코드는 계약만 믿고 작성)

## 파일 소유권 (이 파일들만 생성/수정 가능)
- `src/app/play/**`
- `src/components/play/**`
- 그 외 파일(특히 `package.json`, `src/lib/**`, `src/app/api/**`, `src/app/admin/**`, `src/app/page.tsx`, `src/components/ui/**`)은 **절대 수정 금지**. 필요한 게 있으면 최종 보고에 "요청 사항"으로 적어라.
- `npm install`, `next build`, `next dev` 실행 금지. 검증은 `npx tsc --noEmit -p .` 와 `npx eslint src/app/play src/components/play` 만. (다른 사람 파일에서 나는 에러는 무시)

## 화면 명세
`src/app/play/page.tsx` ("use client") — `useLiveState<ParticipantState>("/api/me/state")`.
- `error.status === 401` → `router.replace("/")`.
- 공통 헤더: 내 이름, 세션 상태 배지(READY 준비중 / ACTIVE 진행중 / GUESSING 최종추리 / FINISHED 결과공개), 로그아웃 버튼(`POST /api/auth/logout` 후 `/`).
- 거짓·진실 타이머가 RUNNING/PAUSED 면 모든 화면 상단에 **스티키 미니 타이머 배너** (탭하면 게임 탭 이동).

### 1) READY — 사전 준비 뷰
- TMI 키워드 3종 입력 폼: 라벨은 `keywordSlots[i].label`, 기본값은 `me.keywords`. 각 1~30자. 저장 → `POST /api/me/keywords`. 저장 완료 상태 표시.
- 거짓말 순번 비밀 선택: 1~4 버튼 그리드. 선택값은 기본 가림(●) 처리 + "보기" 토글 (옆 사람이 못 보게). `POST /api/me/lie-turn`.
- 대기 안내: "관리자가 게임을 시작하면 자동으로 넘어가요" + `참가자 {participantCount}명 / 최소 4명`.

### 2) ACTIVE / GUESSING — 메인 대시보드 (하단 고정 탭바 4개)
- **마니또 탭**: 타깃 카드 — 큰 익명 닉네임(`target.alias`), 키워드 3칸(해금: 값 / 힌트만 있음: 힌트 + "조커 힌트" 배지 / 잠김: 🔒 + 라벨). 해금 진행도 (`approvedMissionCount`, `nextUnlockAt`) 프로그레스 바.
  - 조커 찬스 버튼 (`joker.available && !joker.used` 일 때 활성). 누르면 모달: 1회용 경고 → 확인 시 `POST /api/me/joker/start` → 4지선다 → 선택 후 `POST /api/me/joker/answer` → 정답이면 힌트 공개 애니메이션, 오답이면 안내. `joker.pendingQuiz` 가 있으면(새로고침 등) 모달에서 이어서 풀기.
- **미션 탭**: `missions` 목록 (slot 내림차순 — 최신이 위). 각 카드: `#slot`, 제목, 설명, 마감까지 남은 시간 카운트다운(서버 오프셋 `clockOffsetMs` 보정), 내 제출 상태 배지 (없음/검토중/승인✅/반려). `isActive` 이면 "완료 보고" 폼 (한 줄 메모, 선택) → `POST /api/me/mission`. 반려는 재제출 가능.
- **게임 탭 (거짓·진실)**: 내 거짓말 순번 표시 (가림 토글). 타이머 IDLE 이면 순번 변경 가능, 그 외엔 잠김. 큰 원형 카운트다운 (RUNNING: 250ms 갱신 / PAUSED: 일시정지 표시 / ENDED). `truthLie.reveal` 이 오면 "거짓말 순번 공개" 리스트를 순차 등장 애니메이션으로 (이름 + 1~4 중 해당 번호 강조 칩).
- **배팅 탭**: 히든 퀘스트 카드(`bet.hiddenQuest`, 뒤집기 카드 인터랙션), 진영(LIBERAL 자유당/FASCIST 파시스트) + 예측(WIN 승/LOSE 패) 선택 → `POST /api/me/bet` (status OPEN 일 때만), LOCKED 면 잠김 표시, RESULT 면 승리 진영 + 내 적중 여부.
- **GUESSING 일 때**: 대시보드 맨 위(탭 위)에 "최종 추리" 카드 — "내 마니또(타깃 {alias})는 누구일까요?" 후보(`guess.candidates`) 선택 → `POST /api/me/guess`. 현재 선택(`guess.myGuess`) 표시, 변경 가능.

### 3) FINISHED — 엔딩 뷰
- **순환 고리 시각화 애니메이션**: `ending.chain` 의 사람들을 원형으로 SVG 배치, `position` 순서대로 화살표(giver→receiver)가 하나씩 그려지는 애니메이션(약 0.6s 간격, `stroke-dashoffset`). 모바일 폭(360px)에서도 이름이 겹치지 않도록 인원에 따라 반지름/폰트 조정 (4~20명). 마지막에 "A → B → … → A" 텍스트 요약.
- "나의 비밀 마니또는…" 드럼롤 후 `ending.mySecretManito` 공개.
- 베스트 마니또 (`ending.bestManitos`) 🏆 카드.
- 전체 표: giver → receiver(익명 닉네임), 승인 미션 수, 추리 결과(맞춤 ✅/틀림 ❌/미제출).

## 품질 기준
- 360px 폭에서 가로 스크롤 없음. 터치 타깃 ≥ 44px. 다크모드는 토큰으로 자동.
- 모든 액션 버튼: 요청 중 `loading`, 실패 시 `ApiRequestError.message` 를 `ErrorText` 로 표시, 성공 시 `await refresh()`.
- `window.alert/confirm/prompt` 사용 금지 (인라인 확인 UI 사용).
- 컴포넌트 분리: `src/components/play/` 아래 `TargetCard.tsx`, `JokerModal.tsx`, `MissionList.tsx`, `TruthLiePanel.tsx`, `BetPanel.tsx`, `GuessCard.tsx`, `EndingView.tsx`, `ChainRing.tsx`, `PrepView.tsx`, `TimerBanner.tsx` 등.
- 외부 라이브러리 추가 금지 (React + Tailwind 만).

## 완료 보고
작업 끝나면 `docs/2026/2026.09.29/report-antigravity-play.md` 에 생성 파일 목록, tsc/eslint 결과, 요청 사항을 적어라.
