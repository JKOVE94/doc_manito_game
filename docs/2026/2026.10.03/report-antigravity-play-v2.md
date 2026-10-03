# 참가자 화면 v2 (두 관계 구조) 구현 완료 보고

## 1. 개요
v2 게임 규칙 개정(내가 섬기는 사람 `target` 실명 공개, 나를 섬기는 비밀 마니또 `manito` 정체 비공개 및 단계별 힌트 해금, TMI 퀴즈 및 우편함 시스템)에 맞추어 **참가자 화면 v2** 구현을 완료했습니다.

## 2. 변경 파일 목록
- **신규 생성**:
  - `src/components/play/ManitoCard.tsx`: 나를 섬기는 비밀 마니또 힌트 단계별 해금, 포인트 진행바, 출처 표시, 조커 찬스 연동
  - `src/components/play/MailboxPanel.tsx`: 💌 우편함 탭 (받은 질문 목록/답장 입력, 보낸 질문 toTarget / toManito 분리 관리)
  - `src/components/play/QuizModal.tsx`: 🧠 깜짝 TMI 퀴즈 전면 팝업 모달 (카운트다운 타이머, 4지선다, 제출 후 결과 표시 및 2초 자동 리프레시)
- **수정**:
  - `src/components/play/TargetCard.tsx`: 내가 섬기는 친구 카드 (큰 실명 `target.name`, 키워드 3개 칩, 섬김 안내 문구)
  - `src/components/play/AskPanel.tsx`: AI 스무고개 대상 토글 세그먼트(내가 섬기는 친구 vs 비밀 마니또), 질문 공유 부제, 말풍선 대상 칩, `about` 파라미터 전달
  - `src/components/play/MissionList.tsx`: 타깃 안내 헤더, 사진 인증 폼(`<input type="file">`, 썸네일 미리보기, 삭제), 사진/메모 필수 유효성 검사, `uploadMissionPhoto` 연동, 제출 사진 썸네일 및 라이트박스 확대 뷰어
  - `src/components/play/JokerModal.tsx`: 조커 찬스 대상 문구를 "비밀 마니또의 키워드"로 통일
  - `src/components/play/GuessCard.tsx`: 최종 추리 문구를 "🎭 나를 섬긴 비밀 마니또는 누구일까요?"로 변경
  - `src/components/play/EndingView.tsx`: 순환 고리 결과 표에서 `receiverAlias`를 숨기고 receiver 실명만 깔끔하게 노출
  - `src/app/play/page.tsx`: 하단 5개 탭 네비게이션(우편함 미답변 배지 연동), 헤더 퀴즈 점수(`🧠 {quiz.score}점`) 배지, `QuizModal` 전역 모달 배치, 신규 컴포넌트 조합

## 3. 세부 구현 사항

1. **하단 5개 탭 구조 (`page.tsx`)**
   - 🎁 **마니또**: `TargetCard` (내가 섬길 친구) + `ManitoCard` (비밀 마니또 힌트) + `AskPanel` (AI 스무고개) + `JokerModal`
   - 📜 **미션**: `MissionList` (활성 미션이 있을 경우 점 배지 유지)
   - 💌 **우편함**: `MailboxPanel` (`mailbox.unansweredCount > 0`일 때 빨간색 숫자 배지 노출)
   - ⏱️ **거짓·진실**: `TruthLiePanel` (타이머 RUNNING/PAUSED 시 핑 애니메이션 배지)
   - 🎲 **배팅**: `BetPanel`
   - 헤더: 참가자 실명 및 세션 상태 배지와 더불어 `🧠 {quiz.score}점` 배지 추가

2. **마니또 탭 (`TargetCard`, `ManitoCard`, `AskPanel`, `JokerModal`)**
   - **`TargetCard` (교체)**:
     - 내가 섬기는 사람의 실명(`target.name`) 대형 표시
     - 키워드 3개 칩 (`#{slot} {label}: {value}`) 표시
     - "미션으로 이 친구를 몰래 섬겨 주세요!" 섬김 안내 문구 배치
   - **`ManitoCard` (신규)**:
     - `manito.hints`를 레벨 오름차순으로 정렬하여 표시
     - 해금 완료 시 실제 값, 조커 힌트 획득 시 초성/힌트, 잠김 시 `🔒 잠김` 배지 및 안내
     - 누적 포인트 진행바 (`points` / `nextUnlockAt`, 퍼센트 계산)
     - 포인트 출처 breakdown: `미션 {missions} + 퀴즈 {quizzes}`
     - 조커 찬스 버튼 연동 (진행 중인 퀴즈 이어하기 / 1회 사용하기 / 사용 완료 상태 대응)
   - **`AskPanel` (수정)**:
     - 입력창 상단에 대상 토글 세그먼트 제공: `"내가 섬기는 {target.name}"` (`about: "TARGET"`) / `"🎭 비밀 마니또"` (`about: "MANITO"`)
     - 자연어 질문 요청 시 body에 `{ question, about }` 전달
     - 대화 기록 말풍선마다 대상 라벨 칩(`💝 내가 섬기는 ...` / `🎭 비밀 마니또`) 부착
     - 부제: "두 사람에 대한 질문 횟수를 함께 써요 (미션 완료 시 +1)"
     - 남은 질문 수 공유 (`ask.remaining/total`)

3. **미션 탭 (`MissionList`)**
   - 상단 헤더에 `→ {target.name} 님을 위한 미션` 안내 배너 추가
   - 완료 보고 폼:
     - 📷 사진 선택: `<input type="file" accept="image/*" capture="environment">` 연동
     - 첨부 사진 썸네일 미리보기 및 삭제 버튼
     - 한 줄 메모 입력창
     - 유효성 검사: 사진 또는 메모 중 하나 이상 필수
     - 사진이 첨부된 경우 `uploadMissionPhoto(file)`를 통해 Storage에 업로드 후 `photoPath`를 `POST /api/me/mission`에 전달
     - 업로드 및 제출 진행 상태 메시지("사진 올리는 중…", "보고 제출 중…")
   - 제출물 확인:
     - `photoUrl`이 있으면 인증 사진 썸네일 표시
     - 썸네일 클릭 시 모달 라이트박스 뷰어로 확대 확인 가능

4. **우편함 탭 (`MailboxPanel`, 신규)**
   - 상단 세그먼트: **받은 질문** (미답변 개수 배지) / **보낸 질문**
   - **받은 질문**:
     - `mailbox.inbox` 최신순 카드 리스트
     - 보낸이 칩: `MY_MANITO`일 경우 🎭 비밀 마니또, `MY_TARGET`일 경우 💝 이름
     - 이미 작성한 답장이 있는 경우 답변 내용 및 시각 표시
     - 답장이 없는 경우 1~300자 답장 입력창 및 `POST /api/me/mail/answer` (`{ mailId, answer }`) 호출
   - **보낸 질문**:
     - `💝 {target.name} 님에게 (상대는 내가 누군지 몰라요)` 섹션 (`mailbox.toTarget`)
     - `🎭 비밀 마니또에게 (상대는 내 이름을 알아요)` 섹션 (`mailbox.toManito`)
     - 각 섹션별 남은 질문 횟수 `{remaining}/{limit}` 배지
     - 보낸 질문 내역 및 상대방의 답장(없으면 "답장 기다리는 중…") 표시
     - 2~200자 질문 입력 및 `POST /api/me/mail/send` (`{ to, question }`) 연동 (남은 횟수 0일 때 입력 비활성화)

5. **수시 TMI 퀴즈 (`QuizModal`, 신규)**
   - `quiz.pending` 존재 시 화면 전체 전면 모달 자동 팝업
   - `quiz.pending.question` 및 참가자 4인 보기 버튼
   - `expiresAt`과 `clockOffsetMs` 기반 실시간 초단위 카운트다운 타이머
   - 만료 시 "시간 초과" 안내 후 자동 리프레시
   - 보기 선택 시 `POST /api/me/quiz/answer` (`{ quizId, optionIndex }`) 즉시 호출
   - 정답/오답 및 `correctAnswer` 피드백 노출 후 2초 대기 후 닫기 및 `refresh()`

6. **최종 추리 및 엔딩 (`GuessCard`, `EndingView`)**
   - `GuessCard`: 제목을 "🎭 나를 섬긴 비밀 마니또는 누구일까요?"로 변경하고 후보 선택 안내
   - `EndingView`: 전체 결과 표의 "타깃" 열에서 `receiverAlias`를 숨기고 receiver의 실명만 깔끔하게 노출

7. **품질 및 제약 준수**
   - 모바일 360px 너비에서 가로 스크롤 없음 (`break-words`, `min-w-0`, 반응형 여백)
   - 모든 대화형 터치 영역 44px 이상 유지 (`min-h-11` 이상)
   - 브라우저 기본 다이얼로그(`window.alert/confirm`) 일체 배제
   - 외부 라이브러리 추가 설치 없음
   - 모든 비동기 요청에 `loading`, `ErrorText`, 성공 시 `await refresh()` 적용

## 4. 검증 결과

1. **TypeScript 타입 검사**:
   ```bash
   $ npx tsc --noEmit -p .
   # 전체 프로젝트 0 에러 (Exit code: 0)
   ```

2. **ESLint 검사**:
   ```bash
   $ npx eslint src/app/play src/components/play
   # 0 에러, 0 경고 (Exit code: 0)
   ```
