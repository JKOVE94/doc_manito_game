# task-antigravity-testmode.md — 호스트 콘솔 테스트 도구 UI

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. 먼저 읽을 것:
- `src/lib/types.ts` 의 `AdminParticipantRow.isBot`, `AdminState.botCount`, `BotActResult`
- `docs/2026/2026.09.29/api-contract.md` 의 `/api/admin/test/*` 3개
- 네가 만든 `src/app/admin/page.tsx`, `src/components/admin/{SessionControl,ParticipantTable}.tsx`
- `src/components/ui/index.tsx`

## 목표
혼자서도 4인 이상 게임을 테스트할 수 있도록 **봇 참가자** 기반 테스트 도구 UI 를 추가한다. (백엔드는 PM 이 동시에 구현 중 — 계약만 믿을 것)

## 파일 소유권
- 신규: `src/components/admin/TestTools.tsx`
- 수정: `src/app/admin/page.tsx` (TestTools 배치), `src/components/admin/SessionControl.tsx` (봇 경고), `src/components/admin/ParticipantTable.tsx` (봇 표시/봇으로 보기)
- 그 외 수정 금지. `npm install`, `next build`, `next dev` 금지. 검증: `npx tsc --noEmit -p .`, `npx eslint src/app/admin src/components/admin`

## 명세
1. **TestTools** (props: `session: AdminState["session"]`, `participants`, `botCount`, `onRefresh`) — DangerZone 바로 위, `lg:col-span-2`. 제목 "🧪 테스트 도구", 부제 "봇 참가자로 혼자 리허설하기. 실제 파티 전 RESET 하면 봇은 자동 삭제돼요."
   - **봇 추가** (READY 일 때만 활성): 숫자 입력(1~10). 기본값 = `max(1, minParticipants - 실제(비봇) 참가자 수)`. 버튼 "🤖 봇 N명 추가" → `api("/api/admin/test/bots", { action: "add", count })`.
   - **봇 전체 삭제** (READY + botCount>0): 인라인 2단계 확인 → `{ action: "remove" }`.
   - **봇 자동 행동** (ACTIVE 또는 GUESSING + botCount>0): 버튼 "▶ 봇 자동 행동 실행" → `api<BotActResult>("/api/admin/test/act", {})` → 결과 `summary` 를 성공 메시지로 표시 (accent 색).
     설명 문구: "진행 중 미션 제출 · 배팅(열려 있을 때) · 최종 추리(추리 단계일 때)를 봇 전원이 수행해요. 미션 승인은 '미션 제출 검토'에서 직접 하세요."
   - **봇으로 보기**: 봇 목록(`participants.filter(p => p.isBot)`) 각 행에 버튼 → `api("/api/admin/test/impersonate", { participantId })` 성공 시 `window.open("/play", "_blank")`. 안내: "같은 브라우저의 참가자 로그인이 이 봇으로 바뀌어요. 내 참가자 화면은 다른 브라우저/시크릿 창에서 여세요."
2. **SessionControl**: `botCount > 0` 이면 상단에 warn 톤 배너 "🧪 테스트 모드: 봇 {botCount}명 포함 — 실제 파티 전 RESET 하세요". (props 에 `botCount` 추가)
3. **ParticipantTable**: 봇이면 이름 옆 `<Badge tone="warn">봇</Badge>`.
- 모든 액션: loading, 실패 시 `ErrorText`, 성공 시 `await onRefresh()`. `window.alert/confirm/prompt` 금지. 360px 가로 스크롤 금지.

## 완료 보고
`docs/2026/2026.09.29/report-antigravity-testmode.md` 에 변경 파일, tsc/eslint 결과.
