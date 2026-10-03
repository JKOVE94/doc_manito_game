# 자리비움 UI 구현 완료 보고

## 1. 개요
자리비움 규칙(미션 마감 유예 계산 및 수시 퀴즈 일시 중단)에 맞추어 **참가자 화면 및 관리자 화면의 자리비움 UI** 구현을 완료했습니다.

## 2. 파일 변경 사항
- **신규 생성**:
  - `src/components/play/AwayControl.tsx`: 참가자용 자리비움 컨트롤
    - 자리에 있을 때: 인라인 확인 배너("잠시 자리를 비우나요? 비운 시간만큼 미션 마감이 연장돼요") 및 확인 시 `api("/api/me/away", { away: true })` 호출
    - 자리비움 중: 전체 폭 warn 톤 배너("🚶 자리비움 중 · {경과 mm:ss} — 미션 마감이 연장되고 퀴즈는 쉬어요") 및 큰 복귀 버튼("✋ 복귀했어요")으로 `api("/api/me/away", { away: false })` 호출
    - `awaySince`와 `clockOffsetMs` 기반 1초 간격 경과 시간 갱신
    - 헤더용 작은 버튼 `AwayButton` (`AwayControl.Button`) 내장
- **수정**:
  - `src/app/play/page.tsx`:
    - ACTIVE / GUESSING 세션 상태(`isDashboardMode`)에서만 헤더 로그아웃 버튼 왼쪽에 작은 버튼 "🚶 자리비움" 노출
    - 버튼 클릭 시 헤더 바로 아래에 전체 폭 인라인 확인 배너 표시
    - 자리비움 중일 때 헤더 아래 전체 폭 warn 톤 배너 및 "✋ 복귀했어요" 큰 버튼 렌더링
  - `src/components/play/MissionList.tsx`:
    - 미션 카운트다운 타이머 및 활성 판정 기준을 `deadline` 대신 **`myDeadline`**으로 변경
    - `graceSec > 0`인 경우 미션 슬롯 제목 옆에 accent 배지 `⏳ 유예 +{Math.round(graceSec / 60)}분` 추가
    - 클라이언트 타이머 만료 시 마감 상태로 전환되어 미제출 폼 비활성화
  - `src/components/admin/ParticipantTable.tsx`:
    - 참가자 이름 옆 `awaySince`가 존재하면 warn 배지 `자리비움` 표시
    - ACTIVE / GUESSING 세션 상태일 때 각 행 액션 버튼 제공:
      - 자리에 있을 때: `자리비움` 버튼 (`api("/api/admin/away", { participantId, away: true })`)
      - 자리비움 중일 때: `복귀` 버튼 (`api("/api/admin/away", { participantId, away: false })`)
    - 테이블 헤더에 세션 상태에 따라 `관리`(READY) 또는 `자리비움`(ACTIVE/GUESSING) 열 표시

## 3. 세부 사양 및 품질 준수 확인

1. **상태별 UI 분기**
   - **자리에 있을 때 (`awaySince === null`)**:
     - 헤더에 작은 버튼 "🚶 자리비움" 표시
     - 누르면 헤더 하단에 전체 폭 인라인 확인 상자가 펼쳐지며 안내 문구("잠시 자리를 비우나요? 비운 시간만큼 미션 마감이 연장돼요")와 취소/확인 버튼 표시
     - 확인 클릭 시 로딩 스피너 및 비활성화 처리 후 `POST /api/me/away` (`{ away: true }`) 호출, 성공 시 `refresh()`
   - **자리비움 중 (`awaySince !== null`)**:
     - 헤더의 작은 버튼은 숨겨지고, 헤더 바로 아래에 전체 폭 warn 톤 배너 노출
     - "🚶 자리비움 중 · {경과 mm:ss} — 미션 마감이 연장되고 퀴즈는 쉬어요" 문구와 함께 1초마다 실시간 경과 시간 업데이트 (`formatClock` 활용)
     - 하단에 큰 버튼 "✋ 복귀했어요" 노출, 클릭 시 `POST /api/me/away` (`{ away: false }`) 호출 및 `refresh()`

2. **미션 유예시간 및 개인 마감 표시 (`MissionList.tsx`)**
   - 기존 `mission.deadline` 대신 개인별 유예가 반영된 `mission.myDeadline`을 우선 참조하여 남은 시간 카운트다운 및 마감 처리 계산
   - `mission.graceSec > 0`일 때 제목 옆에 `<Badge tone="accent">⏳ 유예 +{분}분</Badge>` 칩 표시
   - 유예 시간 초 단위를 분 단위(`Math.round(graceSec / 60)`)로 변환하여 사용자 친화적으로 노출

3. **관리자 화면 연동 (`ParticipantTable.tsx`)**
   - 참가자 이름 옆 `p.awaySince` 여부에 따라 `<Badge tone="warn">자리비움</Badge>` 표시
   - ACTIVE / GUESSING 단계에서 행별로 자리비움 토글 버튼 노출:
     - `p.awaySince`가 있으면 warn 스타일의 `복귀` 버튼
     - 없으면 보조 스타일의 `자리비움` 버튼
   - 클릭 시 행별 로딩 상태(`awayLoadingId`) 적용, `POST /api/admin/away` 호출 후 `onRefresh()` 트리거

4. **공통 제약 사항 준수**
   - 브라우저 기본 다이얼로그(`window.alert/confirm`) 일체 배제, 인라인 확인 UI 적용
   - 모든 비동기 작업에 `loading`, 에러 메시지(`ErrorText`), 성공 시 `refresh` 적용
   - 모바일 360px 너비 환경에서 가로 스크롤이 발생하지 않도록 `break-words`, `flex-wrap`, 반응형 너비 설계 준수
   - 정해진 파일 외 수정 및 금지 명령어 준수

## 4. 검증 결과

1. **TypeScript 타입 검사 (`npx tsc --noEmit -p .`)**:
   - 에러 0건 통과 (Exit code: 0)

2. **ESLint 정적 분석 (`npx eslint src/app/play src/components/play src/components/admin`)**:
   - 에러 0건, 경고 0건 통과 (Exit code: 0)

3. **단위 테스트 (`npm test` / Vitest)**:
   - 27개 테스트 전체 통과 (Exit code: 0)
