# API Contract

모든 응답은 JSON. 실패 시 `{ "error": "한국어 메시지" }` + 4xx/5xx.
응답 타입은 `src/lib/types.ts` 참조. 클라이언트는 `api()` (`src/lib/client/api.ts`) 로 호출:
`api<T>(path)` → GET, `api<T>(path, body)` → POST.

## 참가자 (쿠키 `mp_session`)

| Method | Path | Body | Response | 비고 |
|---|---|---|---|---|
| POST | `/api/auth/join` | `{ name, pin }` | `{ ok, participantId }` | 이름 존재+PIN 일치 → 로그인 / 신규 이름 → READY 일 때만 가입. PIN 은 숫자 4자리 |
| POST | `/api/auth/logout` | – | `{ ok }` | |
| GET | `/api/me/state` | – | `ParticipantState` | 비로그인 401 |
| POST | `/api/me/keywords` | `{ keywords: [string, string, string] }` | `{ ok }` | READY 에서만 |
| POST | `/api/me/lie-turn` | `{ lieTurn: 1\|2\|3\|4 }` | `{ ok }` | 타이머 IDLE 일 때만 변경 가능 |
| POST | `/api/me/mission` | `{ slot, note }` | `{ ok }` | 활성 미션만, 반려된 건 재제출 가능 |
| POST | `/api/me/joker/start` | – | `JokerQuizView` | 1회. 재호출 시 같은 퀴즈 반환 |
| POST | `/api/me/joker/answer` | `{ optionIndex: 0..3 }` | `{ correct: boolean, hint: string \| null }` | 1회 |
| POST | `/api/me/ask` | `{ question }` (2~100자) | `AskResult` | AI 스무고개. ACTIVE 에서만. 기회 = 3 + 승인 미션 수. 소진 시 429, AI 오류 502/503. 잠긴 키워드가 드러난 답은 가려지고 기회 미차감 |
| POST | `/api/me/bet` | `{ faction: 'LIBERAL'\|'FASCIST', prediction: 'WIN'\|'LOSE' }` | `{ ok }` | bet OPEN 일 때만 |
| POST | `/api/me/guess` | `{ participantId }` | `{ ok }` | GUESSING 에서만, 변경 가능 |

## 관리자 (쿠키 `mp_admin`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/admin/login` | `{ password }` | `{ ok }` |
| POST | `/api/admin/logout` | – | `{ ok }` |
| GET | `/api/admin/state` | – | `AdminState` |
| POST | `/api/admin/session` | `{ action: 'start', force?: boolean }` | `{ ok }` / 409 `{ error, missing?: string[] }` (키워드 미입력자) |
|  |  | `{ action: 'guessing' \| 'finish' \| 'back-to-active' }` | `{ ok }` |
|  |  | `{ action: 'reset', confirm: 'RESET', keepParticipants?: boolean }` | `{ ok }` |
| POST | `/api/admin/participant/remove` | `{ participantId }` | `{ ok }` (READY 에서만) |
| POST | `/api/admin/timer` | `{ action: 'start', durationSec }` \| `{ action: 'pause'\|'resume'\|'end'\|'reset'\|'reveal'\|'hide' }` | `{ ok }` |
| POST | `/api/admin/mission/save` | `{ slot, title, description }` | `{ ok }` |
| POST | `/api/admin/mission/open` | `{ slot, durationMin }` | `{ ok }` (지금부터 durationMin 분 뒤 마감) |
| POST | `/api/admin/mission/close` | `{ slot }` | `{ ok }` (즉시 마감) |
| POST | `/api/admin/submission/review` | `{ submissionId, decision: 'APPROVED'\|'REJECTED'\|'PENDING' }` | `{ ok }` → 해금 레벨 자동 재계산 |
| POST | `/api/admin/chain/unlock` | `{ chainId, level: 0..3 }` | `{ ok }` 수동 보정 |
| POST | `/api/admin/test/bots` | `{ action: 'add', count: 1..10 }` \| `{ action: 'remove' }` | `{ ok }` 🧪 봇 추가/전체 삭제 (READY 에서만) |
| POST | `/api/admin/test/act` | – | `BotActResult` 🧪 봇 전원이 현재 단계 행동 (활성 미션 제출, 배팅 OPEN 이면 배팅, GUESSING 이면 추리) |
| POST | `/api/admin/test/impersonate` | `{ participantId }` | `{ ok }` 🧪 **봇만** 가능. 참가자 쿠키를 봇으로 설정 → 클라이언트가 `/play` 로 이동 |
| POST | `/api/admin/bet` | `{ action: 'open'\|'lock' }` \| `{ action: 'result', winningFaction }` | `{ ok }` |

## 실시간
`useLiveState<ParticipantState>("/api/me/state")` / `useLiveState<AdminState>("/api/admin/state")`
→ `{ data, error, refresh, clockOffsetMs }`. 액션 후엔 `await refresh()` 호출.
타이머 표시: `remainingSeconds(timer, clockOffsetMs)` 를 250ms 간격으로 재계산.


---

## v2 변경 (2026-10-03) — 두 관계 구조

- **target** = 내가 섬기는 사람 (**이름 공개**, 키워드 3개 공개). 미션은 이 사람을 섬기는 내용.
- **manito** = 나를 섬기는 비밀 마니또 (**정체 비공개**). 최종 추리 대상.
- 힌트 포인트 = 내 승인 미션 수 + 내 퀴즈 정답 수 (+관리자 보정) → 포인트가 `HINT_THRESHOLDS`(config) 에 도달할 때마다 manito 힌트 1단계 해금
  (1~3: manito 키워드 3개, 4: 이름 글자 수, 5: 이름 초성)
- 조커 찬스 = manito 의 잠긴 키워드 대상

| Method | Path | Body | Response | 비고 |
|---|---|---|---|---|
| POST | `/api/me/mission/upload-url` | `{ contentType }` | `{ bucket, path, token }` | 클라이언트는 `uploadMissionPhoto(file)` (`src/lib/client/upload.ts`) 만 쓰면 됨 |
| POST | `/api/me/mission` | `{ slot, note?, photoPath? }` | `{ ok }` | 메모 또는 사진 중 하나 이상 필수 |
| POST | `/api/me/quiz/answer` | `{ quizId, optionIndex: 0..3 }` | `QuizAnswerResult` | 수시 TMI 퀴즈. 퀴즈는 서버가 랜덤 시점에 자동 생성 → `state.quiz.pending` 으로 내려옴. 만료 시 자동 오답 처리 |
| POST | `/api/me/mail/send` | `{ to: 'TARGET'\|'MANITO', question }` (2~200자) | `{ ok }` | 방향별 3개 제한 |
| POST | `/api/me/mail/answer` | `{ mailId, answer }` (1~300자) | `{ ok }` | 내게 온 질문에 답장 (1회, 수정 불가) |
| POST | `/api/me/ask` | `{ question, about: 'TARGET'\|'MANITO' }` | `AskResult` | AI 스무고개. 두 대상이 질문 횟수 공유 |
| POST | `/api/me/guess` | `{ participantId }` | `{ ok }` | **나를 섬긴 비밀 마니또** 지목 |
| POST | `/api/admin/tmi` | `{ text }` | `{ ok, factCount }` | TMI 전체 교체. 형식: JSON `[{name, fact}]` 또는 줄마다 `이름: TMI` (`이름 \| TMI`, 탭 구분도 가능) |
| POST | `/api/admin/quiz` | `{ action: 'send-now' }` | `{ ok }` | 전원에게 즉시 퀴즈 발송 (대기 중 퀴즈 없는 사람) |

### 자리비움 (2026-10-03)
| Method | Path | Body | Response | 비고 |
|---|---|---|---|---|
| POST | `/api/me/away` | `{ away: boolean }` | `{ ok }` | 본인이 자리비움 설정/복귀 |
| POST | `/api/admin/away` | `{ participantId, away: boolean }` | `{ ok }` | 호스트가 대신 설정/복귀 |

- 유예 규칙: 미션별 **나의 마감** = 공통 마감 + (그 미션이 열려 있던 동안 자리비움한 시간) + 복귀 버퍼 10분(유예가 있을 때만). `MissionView.myDeadline`, `graceSec`.
- 자리비움 중에는 수시 퀴즈가 오지 않고, 대기 중 퀴즈는 취소(오답 처리 안 함).
- `ParticipantState.me.awaySince`, `AdminParticipantRow.awaySince`.

### 관리자 비밀번호 DB 관리 (2026-10-03)
| Method | Path | Body | Response | 비고 |
|---|---|---|---|---|
| GET | `/api/admin/status` | – | `{ needsSetup: boolean }` | 로그인 불필요. DB·환경변수 어디에도 비밀번호가 없으면 true |
| POST | `/api/admin/setup` | `{ password }` (4~100자) | `{ ok }` | needsSetup 일 때만. 비밀번호 저장 + 바로 로그인 |
| POST | `/api/admin/password` | `{ currentPassword, newPassword }` | `{ ok }` | 관리자 로그인 필요. 변경 즉시 다른 기기 관리자 세션 만료, 현재 기기는 재로그인 처리 |
- `SESSION_SECRET` 환경변수 불필요 (DB 자동 생성). `ADMIN_PASSWORD` 는 DB 미설정 시 fallback.

### 변경 (2026-10-04)
- `POST /api/me/ask` — `about` 파라미터 폐지. **나를 섬기는 비밀 마니또에 대해서만** 질문 (섬기는 친구는 이미 공개). 본문 `{ question }`
- 거짓·진실 타이머: 종료(수동 종료 또는 시간 만료) 후 **5분 뒤 순번 자동 공개**. `TimerView.revealAt` (공개 전·종료 상태에서만 값). 호스트의 `reveal` 액션은 즉시 공개
