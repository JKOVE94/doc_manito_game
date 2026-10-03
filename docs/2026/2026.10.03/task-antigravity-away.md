# task-antigravity-away.md — 자리비움 UI

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. 먼저 읽을 것:
- `src/lib/types.ts`: `ParticipantState.me.awaySince`, `MissionView.myDeadline` / `graceSec`, `AdminParticipantRow.awaySince`
- `docs/2026/2026.09.29/api-contract.md` 맨 아래 "자리비움" 섹션
- 네가 만든 `src/app/play/page.tsx`, `src/components/play/MissionList.tsx`, `src/components/admin/ParticipantTable.tsx`

## 파일 소유권
- 수정: `src/app/play/page.tsx`, `src/components/play/MissionList.tsx`, `src/components/admin/ParticipantTable.tsx`
- 신규: `src/components/play/AwayControl.tsx`
- 그 외 금지. `npm install`/`next build`/`next dev` 금지. 검증 `npx tsc --noEmit -p .`, `npx eslint src/app/play src/components/play src/components/admin` 0 에러.

## 명세
1. **AwayControl** (참가자, ACTIVE/GUESSING 에서만 표시)
   - 자리에 있을 때: 헤더(로그아웃 버튼 왼쪽)에 작은 버튼 "🚶 자리비움". 누르면 인라인 확인("잠시 자리를 비우나요? 비운 시간만큼 미션 마감이 연장돼요") → `api("/api/me/away", { away: true })` → refresh.
   - 자리비움 중: 헤더 아래 전체 폭 warn 톤 배너 "🚶 자리비움 중 · {경과 mm:ss} — 미션 마감이 연장되고 퀴즈는 쉬어요" + 큰 버튼 "✋ 복귀했어요" → `api("/api/me/away", { away: false })`. 경과 시간은 `awaySince` 와 clockOffsetMs 로 1초마다 갱신.
2. **MissionList**: 카운트다운·활성 판단에 `deadline` 대신 **`myDeadline`** 사용. `graceSec > 0` 이면 제목 옆 accent 배지 "⏳ 유예 +{분}분".
3. **ParticipantTable** (관리자): 이름 옆 `awaySince` 있으면 warn 배지 "자리비움". 각 행(ACTIVE/GUESSING 일 때) 버튼: 자리에 있으면 "자리비움" / 비움 중이면 "복귀" → `api("/api/admin/away", { participantId, away })` → refresh.
- loading / ErrorText / refresh, `window.alert/confirm` 금지, 360px 가로 스크롤 금지.

## 완료 보고
`docs/2026/2026.10.03/report-antigravity-away.md`
