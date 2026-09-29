# task-antigravity-ask.md — AI 스무고개 힌트 패널 (참가자 화면 추가)

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. 먼저 읽을 것:
- `src/lib/types.ts` 의 `AskVerdict`, `AskEntryView`, `AskView`, `AskResult`, `ParticipantState.ask`
- `docs/2026/2026.09.29/api-contract.md` 의 `POST /api/me/ask`
- 네가 만든 `src/app/play/**`, `src/components/play/**` (특히 마니또 탭의 타깃 카드)
- `src/components/ui/index.tsx`

## 목표
마니또 탭의 타깃 카드 바로 아래에 **"AI 스무고개"** 패널을 추가한다. 참가자가 타깃에 대해 자연어로 질문하면 AI 가 예/아니오/조금/알 수 없음 + 한 문장 힌트로 답한다.

## 파일 소유권
- 신규: `src/components/play/AskPanel.tsx`
- 수정: 마니또 탭을 렌더링하는 파일 1곳 (AskPanel 삽입만)
- 그 외 수정 금지. `npm install`, `next build`, `next dev` 금지. 검증: `npx tsc --noEmit -p .`, `npx eslint src/components/play src/app/play`

## 명세 (`AskPanel`, props: `ask: AskView`, `alias: string`, `onRefresh: () => Promise<void>`)
- `state.ask` 가 null 이면 렌더하지 않음.
- 헤더: "🔮 AI 스무고개" + 배지 `남은 질문 {remaining}/{total}`. 부제: "미션을 완료하면 질문 기회가 1개씩 늘어나요".
- `enabled=false` 면 입력 비활성 + 안내 ("게임 진행 중에만 사용할 수 있어요" 또는 AI 미설정).
- 대화 기록 `history` 를 채팅 말풍선으로: 내 질문(오른쪽), AI 답(왼쪽) — 답변 앞에 verdict 칩 (YES `예` accent / NO `아니오` danger / PARTLY `조금` warn / UNKNOWN `알 수 없음` neutral).
- 입력창: placeholder `예: "${alias}님은 운동을 좋아하나요?"`, maxLength=`maxLength`, 글자수 카운터, Enter 전송.
- 전송 → `api<AskResult>("/api/me/ask", { question })`. 요청 중: 내 질문 말풍선을 즉시 보여주고 AI 쪽에 "생각 중…" 점 3개 애니메이션. 성공 시 입력창 비우고 `await onRefresh()`.
  - 응답이 history 에 저장되지 않는 경우(힌트가 너무 직접적이라 가려진 답)도 있으므로, 마지막 응답(`AskResult`)은 refresh 후에도 history 에 없으면 로컬로 한 번 표시해 줄 것.
- 실패 시 `ApiRequestError.message` 를 `ErrorText` 로 (429 = 기회 소진, 502/503 = AI 오류).
- `remaining === 0` 이면 입력 비활성 + "질문 기회를 모두 썼어요".
- 기록이 많으면 패널 내부 스크롤 (max-h), 새 메시지 시 맨 아래로 스크롤.
- 360px 폭 가로 스크롤 금지, 터치 타깃 ≥ 44px, `window.alert/confirm` 금지, 외부 라이브러리 금지.

## 완료 보고
`docs/2026/2026.09.29/report-antigravity-ask.md` 에 변경 파일, tsc/eslint 결과.
