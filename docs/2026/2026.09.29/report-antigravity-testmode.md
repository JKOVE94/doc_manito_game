# 호스트 콘솔 테스트 도구 UI 구현 완료 보고

## 1. 개요
혼자서도 4인 이상 게임을 리허설 및 테스트할 수 있도록 호스트 콘솔에 **봇 참가자 기반 테스트 도구 UI**를 구현했습니다.

## 2. 변경 파일 목록
- **신규 생성**:
  - `src/components/admin/TestTools.tsx`: 봇 추가/삭제, 봇 자동 행동, 봇으로 보기(impersonate) 컴포넌트
- **수정**:
  - `src/app/admin/page.tsx`: DangerZone 바로 위 `lg:col-span-2`에 `TestTools` 배치 및 `SessionControl`에 `botCount` 전달
  - `src/components/admin/SessionControl.tsx`: `botCount > 0`일 때 상단에 warn 톤 배너 표시
  - `src/components/admin/ParticipantTable.tsx`: 봇 참가자 이름 옆 `<Badge tone="warn">봇</Badge>` 및 "봇으로 보기" 액션 버튼 추가

## 3. 세부 구현 사항
1. **`TestTools` 컴포넌트** (`lg:col-span-2`):
   - **봇 추가 (READY 상태에서만 활성화)**:
     - 1~10명 범위 숫자 입력 (기본값: `max(1, minParticipants - 실제 참가자 수)`).
     - "🤖 봇 N명 추가" 버튼을 통해 `/api/admin/test/bots` (`action: "add", count`) 호출.
   - **봇 전체 삭제 (READY && botCount > 0)**:
     - 오작동 방지를 위한 인라인 2단계 확인 UI (삭제 확인 / 취소).
     - `/api/admin/test/bots` (`action: "remove"`) 호출.
   - **봇 자동 행동 (ACTIVE 또는 GUESSING && botCount > 0)**:
     - "▶ 봇 자동 행동 실행" 버튼 클릭 시 `/api/admin/test/act` 호출.
     - 응답받은 `summary` 결과를 accent 톤의 결과 메시지로 표시.
   - **봇으로 보기**:
     - 봇 목록(`isBot === true`) 표시 및 각 행마다 "👁️ 봇으로 보기" 버튼 제공.
     - `/api/admin/test/impersonate` 호출 성공 시 새 탭(`window.open("/play", "_blank")`)으로 봇 참가자 화면 오픈.
2. **`SessionControl` 컴포넌트**:
   - `botCount > 0`일 때 카드 상단에 warn 톤 경고 배너 렌더링:
     `🧪 테스트 모드: 봇 {botCount}명 포함 — 실제 파티 전 RESET 하세요`
3. **`ParticipantTable` 컴포넌트**:
   - 봇 참가자의 경우 이름 옆에 `<Badge tone="warn">봇</Badge>` 표시.
   - 테이블 내에서도 빠르게 봇 시점을 확인할 수 있도록 "봇으로 보기" 버튼 제공.
4. **UX & 안정성**:
   - 모든 비동기 동작에 로딩 스피너 및 에러 메시지(`ErrorText`) 표시.
   - 성공 시 상태 갱신(`await onRefresh()`).
   - `window.alert/confirm/prompt` 사용 배제.
   - 360px 모바일 화면에서도 가로 스크롤이 발생하지 않도록 flex-wrap 및 반응형 레이아웃 적용.

## 4. 검증 결과
- **TypeScript 타입 체크**:
  ```bash
  $ npx tsc --noEmit -p .
  # Exit code: 0 (오류 없음)
  ```
- **ESLint 검사**:
  ```bash
  $ npx eslint src/app/admin src/components/admin
  # Exit code: 0 (오류 및 경고 없음)
  ```
