# task-antigravity-play-v2.md — 참가자 화면 v2 (두 관계 구조)

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. **먼저 읽을 것**:
- `src/lib/types.ts` (전면 개정됨 — `ParticipantState`, `TargetView`, `ManitoView`, `ManitoHintView`, `QuizView`, `QuizAnswerResult`, `MailboxView`, `InboxItemView`, `AskAbout`, `AskEntryView`, `MissionView.mySubmission.photoUrl`)
- `docs/2026/2026.09.29/api-contract.md` 맨 아래 **"v2 변경"** 섹션
- `src/lib/client/upload.ts` (`uploadMissionPhoto(file) → photoPath`)
- 네가 만든 기존 `src/app/play/page.tsx`, `src/components/play/**`

## 게임 규칙 변경 (핵심)
1. **내가 섬기는 사람(target)** 은 이름이 공개된다. 미션은 이 사람을 섬기는 것 (사진 인증).
2. **나를 섬기는 비밀 마니또(manito)** 는 정체 비공개. 미션 승인·퀴즈 정답으로 포인트를 모으면 manito 힌트가 1단계씩 열린다. 최종 추리는 manito 를 맞히는 것.

## 파일 소유권
- `src/app/play/**`, `src/components/play/**` 만 생성/수정. 그 외 금지. `npm install`/`next build`/`next dev` 금지.
- 검증: `npx tsc --noEmit -p .` 와 `npx eslint src/app/play src/components/play` 가 **0 에러**여야 완료. (서버 코드는 PM 이 동시에 수정 중 — 다른 파일 에러는 무시)

## 변경 명세
### 탭 (하단 5개): 🎁 마니또 / 📜 미션 / 💌 우편함 / ⏱️ 거짓·진실 / 🎲 배팅
- 우편함 탭에 `mailbox.unansweredCount > 0` 이면 빨간 숫자 배지.

### 마니또 탭
1. **TargetCard (교체)** — "내가 섬기는 친구" 카드: 큰 이름(`target.name`), 키워드 3개 칩(label: value), 안내 "미션으로 이 친구를 몰래 섬겨 주세요!".
2. **ManitoCard (신규, 기존 TargetCard 의 해금 UI 재사용)** — "🎭 나를 섬기는 비밀 마니또": `manito.hints` 를 level 순으로 (해금: 값 / 조커 힌트만: hint + 배지 / 잠김: 🔒 label). 포인트 진행바: `points` / `nextUnlockAt`, 출처 표시 "미션 {pointSources.missions} + 퀴즈 {pointSources.quizzes}". 조커 찬스 버튼(기존 JokerModal 재사용, 문구를 '비밀 마니또의 키워드'로).
3. **AskPanel 수정** — 입력 위에 대상 토글 세그먼트: `"내가 섬기는 {target.name}"` (about=TARGET) / `"🎭 비밀 마니또"` (about=MANITO). 요청 body `{ question, about }`. 기록 말풍선에 대상 라벨 칩. 남은 질문은 공유(`ask.remaining/total`). 부제: "두 사람에 대한 질문 횟수를 함께 써요".

### 미션 탭 (MissionList 수정)
- 제목 아래 "→ {target.name} 님을 위한 미션" (target 을 props 로 전달).
- 완료 보고 폼: 📷 사진 선택(`<input type="file" accept="image/*" capture="environment">`, 미리보기 썸네일, 제거 버튼) + 메모. 사진 또는 메모 중 하나는 필수.
  제출: 사진 있으면 `const photoPath = await uploadMissionPhoto(file)` (업로드 중 "사진 올리는 중…") → `api("/api/me/mission", { slot, note, photoPath })`.
- 내 제출에 `photoUrl` 있으면 썸네일 표시 (탭하면 크게).

### 💌 우편함 탭 (MailboxPanel 신규)
- 상단 세그먼트: **받은 질문** / **보낸 질문**.
- 받은 질문: `mailbox.inbox` 카드 목록 — 보낸이 `fromLabel` (MY_MANITO 는 🎭 아이콘, MY_TARGET 은 이름), 질문, 답장 있으면 표시 / 없으면 답장 입력(1~300자) → `api("/api/me/mail/answer", { mailId, answer })`.
- 보낸 질문: 두 섹션 — "💝 {target.name} 님에게 (상대는 내가 누군지 몰라요)" (`toTarget`), "🎭 비밀 마니또에게 (상대는 내 이름을 알아요)" (`toManito`). 각 섹션: 남은 횟수 `{remaining}/{limit}`, 보낸 질문+답 목록(답 없으면 "답장 기다리는 중…"), 입력창(2~200자) → `api("/api/me/mail/send", { to: "TARGET" | "MANITO", question })`. remaining 0 이면 입력 비활성.

### 🧠 수시 TMI 퀴즈 (QuizModal 신규, 모든 탭 위에 뜸)
- `quiz.pending` 이 있으면 전면 모달: "🧠 깜짝 TMI 퀴즈!", 질문, 4지선다 버튼, 남은 시간 카운트다운(`expiresAt`, clockOffsetMs 보정; 0 이 되면 "시간 초과" 후 닫기+refresh).
- 선택 → `api<QuizAnswerResult>("/api/me/quiz/answer", { quizId, optionIndex })` → 정답/오답 + `correctAnswer` 표시 ("정답! 힌트 포인트 +1 🎉"), 2초 후 닫기 + refresh.
- 헤더에 작은 "🧠 {quiz.score}점" 배지.

### 최종 추리 (GuessCard 문구)
- "🎭 나를 섬긴 비밀 마니또는 누구일까요?" 로 변경.

### 엔딩 (EndingView)
- `ending.mySecretManito` 공개 문구 유지. 표의 "타깃" 열은 receiver 이름 (`receiverAlias` 는 숨김).

## 품질
- 360px 가로 스크롤 없음, 터치 ≥44px, `window.alert/confirm` 금지, 외부 라이브러리 금지.
- 모든 액션 loading / `ErrorText` / 성공 시 `await refresh()`.

## 완료 보고
`docs/2026/2026.10.03/report-antigravity-play-v2.md`
