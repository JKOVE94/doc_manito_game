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
| POST | `/api/admin/bet` | `{ action: 'open'\|'lock' }` \| `{ action: 'result', winningFaction }` | `{ ok }` |

## 실시간
`useLiveState<ParticipantState>("/api/me/state")` / `useLiveState<AdminState>("/api/admin/state")`
→ `{ data, error, refresh, clockOffsetMs }`. 액션 후엔 `await refresh()` 호출.
타이머 표시: `remainingSeconds(timer, clockOffsetMs)` 를 250ms 간격으로 재계산.
