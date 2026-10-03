# task-antigravity-admin-v2.md — 호스트 콘솔 v2

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. **먼저 읽을 것**:
- `src/lib/types.ts` 의 `AdminState` (새 필드: `tmi`, `quiz`, `maxHintLevel`, `AdminSubmissionRow.photoUrl`, `AdminChainRow.receiverPoints`, `AdminParticipantRow.quizScore`)
- `docs/2026/2026.09.29/api-contract.md` 맨 아래 **"v2 변경"** 섹션 (`/api/admin/tmi`, `/api/admin/quiz`)
- 네가 만든 `src/app/admin/page.tsx`, `src/components/admin/**`

## 파일 소유권
- `src/app/admin/**`, `src/components/admin/**` 만. 그 외 금지. `npm install`/`next build`/`next dev` 금지.
- 검증: `npx tsc --noEmit -p .`, `npx eslint src/app/admin src/components/admin` **0 에러**. (다른 파일 에러 무시)

## 변경 명세
1. **TmiManager (신규)** — "📚 TMI 퀴즈 데이터": 현재 `tmi.factCount`개, 이름별 목록(`subjects`: 이름, 개수, matched=false 면 warn 배지 "참가자 이름과 불일치 — 퀴즈 제외").
   큰 textarea + 안내("JSON `[{\"name\":\"홍길동\",\"fact\":\"...\"}]` 또는 줄마다 `이름: TMI`") + "전체 교체 저장" (인라인 2단계 확인) → `api<{ok:true,factCount:number}>("/api/admin/tmi", { text })`.
   퀴즈 현황: 대기 `quiz.pendingCount`, 응답 `quiz.answeredCount`, 정답 `quiz.correctCount`. 버튼 "🧠 지금 전원에게 퀴즈 보내기" (ACTIVE 일 때만) → `api("/api/admin/quiz", { action: "send-now" })`.
2. **SubmissionReview** — `photoUrl` 있으면 썸네일(가로 전체, max-h-64, object-cover, 탭하면 새 탭 원본). 사진 없는 제출은 "사진 없음" 표시.
3. **ChainBoard** — 열 의미 변경: "giver → receiver" 행에서 `unlockedLevel` 은 **receiver 가 giver(비밀 마니또)에 대해 해금한 단계** (0~`maxHintLevel`). 라벨 "받는 사람의 힌트 단계", ± 버튼 범위 0~maxHintLevel. `receiverPoints` 열 추가("받는 사람 포인트"). `approvedMissions` 는 "giver 미션 승인".
4. **ParticipantTable** — `quizScore` 열("퀴즈") 추가.
5. page.tsx 배치: TmiManager 는 MissionManager 다음.

## 품질
360px 가로 스크롤 없음(표는 내부 스크롤), loading/ErrorText/refresh, `window.alert/confirm` 금지.

## 완료 보고
`docs/2026/2026.10.03/report-antigravity-admin-v2.md`
