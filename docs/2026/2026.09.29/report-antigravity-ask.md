# 완료 보고 — AI 스무고개 힌트 패널 (`AskPanel`)

- **작업자**: Antigravity (Frontend Agent)
- **작업 일시**: 2026-09-29
- **대상 화면**: `/play` (참가자 화면의 마니또 탭 - 타깃 카드 바로 아래)
- **기반 기술**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript

---

## 1. 변경 및 생성 파일 목록

| 파일 경로 | 구분 | 역할 및 설명 |
|---|---|---|
| `src/components/play/AskPanel.tsx` | **신규** | **AI 스무고개 힌트 패널**: 헤더(🔮 AI 스무고개 + 남은 질문 배지 + 부제 안내), 대화 기록 채팅 말풍선(내 질문 오른쪽, AI 답 왼쪽 + YES/NO/PARTLY/UNKNOWN verdict 칩), 질문 입력창(placeholder, 글자수 카운터, Enter 전송), 전송 중 내 질문 즉시 표시 + AI 생각 중 점 3개 애니메이션, 성공 시 `await onRefresh()`, 잠긴 키워드 노출 방지로 history 에 저장되지 않은 가려진 마지막 응답 로컬 유지 표시, 429/502/503 에러 메시지 처리, `remaining === 0` 및 `enabled=false` 시 입력 비활성화 및 안내, 패널 내부 스크롤 및 새 메시지 자동 스크롤 |
| `src/app/play/page.tsx` | **수정** | 마니또 탭(`activeTab === "target"`)의 타깃 카드(`TargetCard`) 바로 아래에 `AskPanel` 삽입 (`ask={data.ask}`, `alias={data.target?.alias ?? "타깃"}`, `onRefresh={refresh}`) |

---

## 2. 검증 결과

### 1) TypeScript 컴파일 검증 (`npx tsc --noEmit -p .`)
```
$ npx tsc --noEmit -p .
Exit code: 0
Stdout: (empty - 0 errors)
```
- 프로젝트 전체 타입 검사 통과 (`AskVerdict`, `AskEntryView`, `AskView`, `AskResult`, `ParticipantState.ask` 계약 준수).

### 2) ESLint 검증 (`npx eslint src/components/play src/app/play`)
```
$ npx eslint src/components/play src/app/play
Exit code: 0
Stdout: (empty - 0 errors, 0 warnings)
```
- React 19 최신 훅 규칙 및 core-web-vitals 린트 0건 통과.

---

## 3. 세부 구현 사항 및 명세 충족 내역

- **렌더링 조건 (`state.ask`)**:
  - `state.ask` 가 `null` 이거나 미정의 시 `AskPanel` 은 `null` 을 반환하여 렌더링되지 않음.
- **헤더 & 배지**:
  - 제목 `🔮 AI 스무고개` 및 `남은 질문 {remaining}/{total}` 배지 (`remaining > 0 ? "brand" : "neutral"`).
  - 부제: `"미션을 완료하면 질문 기회가 1개씩 늘어나요"`.
- **활성화 및 기회 소진 상태 처리**:
  - `enabled=false`: 입력창 및 전송 버튼 비활성화, 안내 문구 `"게임 진행 중에만 사용할 수 있어요 (또는 AI 미설정)"`, placeholder `"게임 진행 중에만 사용할 수 있어요"`.
  - `remaining === 0`: 입력창 및 전송 버튼 비활성화, 안내 문구 `"질문 기회를 모두 썼어요"`, placeholder `"질문 기회를 모두 썼어요"`.
- **채팅 말풍선 & Verdict 칩**:
  - 내 질문: 오른쪽 배치 (`bg-brand`, `text-brand-ink`, `rounded-2xl rounded-tr-xs`, `break-words whitespace-pre-wrap`).
  - AI 답변: 왼쪽 배치 (`bg-surface`, `border-line`, `rounded-2xl rounded-tl-xs`, `break-words`).
  - Verdict 칩 매핑:
    - `YES`: `예` (accent tone)
    - `NO`: `아니오` (danger tone)
    - `PARTLY`: `조금` (warn tone)
    - `UNKNOWN`: `알 수 없음` (neutral tone)
- **입력창 & 유효성 검증**:
  - placeholder: `예: "${alias}님은 운동을 좋아하나요?"`.
  - maxLength: `ask.maxLength` (기본 100자), 실시간 글자수 카운터 `{question.length}/{maxLength}`.
  - 2자 이상 입력 검증, Enter 키 전송 (한국어 IME 조합 중 `isComposing` 엔터 중복 제출 방지).
- **비동기 전송 & 생각 중 애니메이션**:
  - 전송 시 내 질문 말풍선을 UI에 즉시 낙관적(optimistic) 렌더링.
  - AI 측에 `"생각 중…"` 점 3개 바운스 애니메이션 표시.
  - `POST /api/me/ask` 성공 시 입력창 초기화 및 `await onRefresh()` 실행.
  - 서버 2차 방어(잠긴 키워드 노출 시 가려진 fallback 힌트)로 인해 history 에 저장되지 않는 응답(`AskResult`)도 `lastResult` 로컬 상태로 패널에 1회 유지 표시.
- **에러 핸들링**:
  - `ApiRequestError.message` 를 포착하여 `<ErrorText>` 로 표시 (429 기회 소진, 502/503 AI 오류 등).
- **스크롤 & 모바일 반응형**:
  - 기록 누적 시 `max-h-72 overflow-y-auto` 내부 스크롤.
  - 새 메시지 수신 및 질문 전송 시 패널 하단으로 자동 부드러운 스크롤(`scrollTo`).
  - 360px 최소 폭 뷰포트 가로 스크롤 없음 (`break-words`, `min-w-0 flex-1`).
  - 터치 타깃 `min-h-11` (44px 이상) 준수.
  - `window.alert` / `window.confirm` 일체 미사용, 외부 라이브러리 추가 없음.
