# 호스트 콘솔 v2 구현 완료 보고

## 1. 개요
v2 관계 구조(내가 섬기는 target과 나를 섬기는 비밀 manito) 및 수시 TMI 퀴즈 시스템 도입에 맞추어 **호스트 콘솔 v2** 구현을 완료했습니다.

## 2. 변경 파일 목록
- **신규 생성**:
  - `src/components/admin/TmiManager.tsx`: TMI 퀴즈 데이터 관리 및 즉시 퀴즈 발송 컴포넌트
- **수정**:
  - `src/components/admin/SubmissionReview.tsx`: 미션 제출 사진(`photoUrl`) 썸네일 표시 및 "사진 없음" 구분 표시
  - `src/components/admin/ChainBoard.tsx`: `unlockedLevel`의 "받는 사람의 힌트 단계"(0~`maxHintLevel`) 반영, `receiverPoints`("받는 사람 포인트") 열 및 "giver 미션 승인" 라벨 적용
  - `src/components/admin/ParticipantTable.tsx`: "퀴즈"(`quizScore`) 점수 열 추가
  - `src/app/admin/page.tsx`: `MissionManager` 다음에 `TmiManager` 배치 및 `ChainBoard`에 `maxHintLevel` prop 전달

## 3. 세부 구현 사항

1. **`TmiManager` (신규 컴포넌트)**
   - **TMI 데이터 현황**:
     - 상단 헤더에 `총 {tmi.factCount}개 등록` 배지 표시
     - 참가자별 TMI 등록 목록(`tmi.subjects`) 표시 (`name`, 개수)
     - `matched=false`인 경우 `<Badge tone="warn">참가자 이름과 불일치 — 퀴즈 제외</Badge>` 경고 배지 표시
   - **퀴즈 현황 및 즉시 발송**:
     - 대기(`quiz.pendingCount`), 응답(`quiz.answeredCount`), 정답(`quiz.correctCount`) 현황 표시
     - `sessionStatus === "ACTIVE"` 일 때만 "🧠 지금 전원에게 퀴즈 보내기" 버튼 활성화 (`disabled` 제어 및 안내 텍스트)
     - 클릭 시 `POST /api/admin/quiz` (`{ action: "send-now" }`) 호출 및 자동 리프레시
   - **TMI 전체 교체 저장**:
     - 대형 텍스트 영역(textarea) 및 입력 형식 가이드(JSON `[{"name":"홍길동","fact":"..."}]` 또는 줄마다 `이름: TMI`, `이름 | TMI`, 탭 구분) 제공
     - `window.alert/confirm` 대신 **인라인 2단계 확인 UI** 적용 (클릭 시 "⚠️ 기존 TMI가 모두 대체됩니다. 저장할까요?" 확인/취소 버튼 전환)
     - 확인 클릭 시 `POST /api/admin/tmi` (`{ text }`) 호출 후 성공 피드백 메시지 노출 및 리프레시

2. **`SubmissionReview`**
   - 제출물에 `photoUrl`이 존재하는 경우:
     - 가로 전체(`w-full`), 최대 높이 `max-h-64`, `object-cover` 썸네일 이미지 렌더링
     - 썸네일 탭/클릭 시 새 탭(`target="_blank" rel="noopener noreferrer"`)에서 원본 사진 열기 지원
   - 사진이 없는 제출물은 `"사진 없음"` 안내 문구 표시

3. **`ChainBoard`**
   - 행의 열 의미를 v2 스펙에 맞게 갱신:
     - `unlockedLevel`: 라벨을 **"받는 사람의 힌트 단계"**로 변경하고, ± 증감 버튼 범위를 `0 ~ maxHintLevel`로 확장 반영
     - `receiverPoints`: **"받는 사람 포인트"** 열 추가 표시 (`{c.receiverPoints}점`)
     - `approvedMissions`: **"giver 미션 승인"** 라벨로 명확화 (`{c.approvedMissions}개`)
   - 조커 찬스 상태 및 최종 추리 결과 유지

4. **`ParticipantTable`**
   - 참가자 테이블에 **"퀴즈"**(`quizScore`) 열 추가 (`{p.quizScore}점`)
   - 컬럼 추가에 맞춰 테이블 최소 너비(`min-w-[620px]`) 및 내부 가로 스크롤 레이아웃 최적화

5. **`page.tsx` 레이아웃 및 UX/품질**
   - 컴포넌트 배치 순서: `SessionControl` → `ParticipantTable` → `TruthLieController` → `MissionManager` → **`TmiManager`** → `SubmissionReview` → `ChainBoard` → `BetController` → `TestTools` → `DangerZone`
   - **모바일 360px 대응**: flex 요소마다 `flex-wrap` 적용, 긴 텍스트 `break-keep`, 테이블은 컨테이너 내부 가로 스크롤로 처리하여 페이지 자체 가로 스크롤 없음
   - **피드백 및 안정성**: 모든 비동기 동작에 `loading` 스피너, `ErrorText`, 성공 메시지, `onRefresh()` 연결
   - 브라우저 기본 모달(`window.alert`, `window.confirm`) 일체 사용 배제

## 4. 검증 결과

1. **TypeScript 타입 검사**:
   ```bash
   $ npx tsc --noEmit -p .
   # src/app/admin/**, src/components/admin/** 내 0 에러 (외부 미작업 파일 에러 제외)
   ```

2. **ESLint 린트 검사**:
   ```bash
   $ npx eslint src/app/admin src/components/admin
   # Exit code: 0 (0 에러, 0 경고)
   ```
