# 완료 보고 — 참가자 게임 화면 (/play) 구현

- **작업자**: Antigravity (Frontend Agent)
- **작업 일시**: 2026-09-29
- **대상 화면**: `/play` (대현목장 마니또 파티 참가자용 모바일 퍼스트 게임 화면)
- **기반 기술**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript

---

## 1. 생성된 파일 목록

| 파일 경로 | 컴포넌트 / 역할 | 설명 |
|---|---|---|
| `src/app/play/page.tsx` | `PlayPage` | 메인 페이지 진입점. `useLiveState` 구독, 401 자동 리다이렉트, 공통 헤더(이름·세션 상태 배지·로그아웃), 스티키 미니 타이머 배너, 세션 상태별 뷰 라우팅(READY / ACTIVE / GUESSING / FINISHED), 하단 고정 4개 탭바 |
| `src/components/play/TimerBanner.tsx` | `TimerBanner` | 거짓·진실 게임 타이머가 RUNNING/PAUSED 일 때 상단에 표시되는 고정 미니 타이머 배너. 250ms 간격 실시간 갱신 및 탭 시 게임 탭으로 즉시 이동 |
| `src/components/play/PrepView.tsx` | `PrepView` | **READY (사전 준비 뷰)**: TMI 키워드 3종 입력 폼(1~30자 검증, 저장 완료 배지), 거짓말 순번 비밀 선택(기본 `●` 가림 + 보기 토글), 실시간 참가자 수 및 최소 인원 달성도 바 |
| `src/components/play/TargetCard.tsx` | `TargetCard` | **마니또 탭**: 내가 섬길 타깃의 대형 익명 닉네임, 키워드 3슬롯(해금 값 / 조커 힌트 배지 / 잠김 상태), 승인 미션 누적 프로그레스 바, 조커 찬스 트리거 버튼 |
| `src/components/play/JokerModal.tsx` | `JokerModal` | **조커 찬스 모달**: 1회용 경고 안내 → 퀴즈 출제(`POST /api/me/joker/start`) → 4지선다 풀기 → 답안 제출(`POST /api/me/joker/answer`) → 정답 시 힌트 공개 축하 애니메이션 및 오답 안내, 중단된 퀴즈(`pendingQuiz`) 이어 풀기 완벽 대응 |
| `src/components/play/MissionList.tsx` | `MissionList` | **미션 탭**: 슬롯 내림차순(최신순) 정렬, `#slot` 제목 및 설명, 서버 시각 오프셋 보정 마감 카운트다운, 제출 상태 배지(승인✅/검토중⏳/반려❌/미제출), 활성 미션 한 줄 메모 완료 보고 폼 및 반려 시 재제출 지원 |
| `src/components/play/TruthLiePanel.tsx` | `TruthLiePanel` | **게임 탭 (거짓·진실)**: 내 거짓말 순번 표시 및 보안 토글, 타이머 IDLE 시 순번 변경, 대형 원형 SVG 카운트다운 타이머(RUNNING/PAUSED/ENDED/IDLE 및 250ms 갱신), 결과 공개 시 1~4번 발언 번호 강조 칩 순차 등장 리스트 |
| `src/components/play/BetPanel.tsx` | `BetPanel` | **배팅 탭**: 시크릿 히틀러 히든 퀘스트 3D 뒤집기 카드(터치 시 회전), 자유당🕊️/파시스트🦅 진영 선택 + 승리🏆/패배💀 예측 배팅(OPEN 상태), LOCKED 마감 상태, RESULT 승리 진영 및 내 적중 여부 축하 카드 |
| `src/components/play/GuessCard.tsx` | `GuessCard` | **최종 추리 카드 (GUESSING 상태 상단 고정)**: 내 타깃 마니또의 진짜 정체를 맞추는 후보 드롭다운 선택 폼, 현재 추리 상태 표시 및 결과 공개 전 변경 지원 |
| `src/components/play/ChainRing.tsx` | `ChainRing` | **순환 고리 시각화**: 원형 SVG 레이아웃, `position` 순서대로 화살표(giver→receiver)가 하나씩 이어지는 순차 애니메이션(~0.6s 간격), 참가자 인원수(4~20명)에 따른 반지름/노드/폰트 크기 반응형 자동 보정, 내 노드 강조, "A → B → … → A" 텍스트 요약, 다시 재생 버튼 |
| `src/components/play/EndingView.tsx` | `EndingView` | **FINISHED (엔딩 뷰)**: "나의 비밀 마니또는…" 1.5초 드럼롤 후 정체 공개 인터랙션, ChainRing 순환 고리, 베스트 마니또 🏆 카드, 전체 매칭 및 미션/추리 결과 반응형 표 |

---

## 2. 검증 결과

### 1) TypeScript 컴파일 검증 (`npx tsc --noEmit -p .`)
```
Exit code: 0
Stdout: (empty - 0 errors)
```
- 프로젝트 전체 타입 검사 통과 (`src/lib/types.ts` 의 계약과 100% 일치).

### 2) ESLint 검증 (`npx eslint src/app/play src/components/play`)
```
Exit code: 0
Stdout: (empty - 0 errors, 0 warnings)
```
- React 19 최신 규칙(`react-hooks/set-state-in-effect` 등) 준수.
- Unused variables 및 lint 규칙 0건 통과.

---

## 3. UI/UX 품질 기준 충족 내역

- **모바일 퍼스트 (360px 무결성)**:
  - 360px 최소 폭 디바이스에서 가로 스크롤(오버플로우)이 발생하지 않도록 모든 카운트다운 타이머, 탭바, 모달, 순환 고리 SVG, 테이블 컨테이너(`overflow-x-auto`)를 완벽히 모바일 최적화.
- **터치 타깃 준수**:
  - 모든 버튼, 입력창, 탭 아이템, 선택 칩의 터치 타깃 높이를 `min-h-11` (44px 이상)으로 확보.
- **다크 모드 지원**:
  - `bg`, `surface`, `surface-2`, `ink`, `ink-soft`, `line`, `brand`, `brand-ink`, `accent`, `warn`, `danger` 시맨틱 토큰을 사용하여 라이트/다크 모드에 자동 대응.
- **반응형 상태 관리 및 에러 핸들링**:
  - 모든 API 요청 시 버튼 `loading` 비활성화 및 처리 중 문구 표시.
  - `ApiRequestError.message` 를 통한 직관적인 한국어 에러 메시지 `<ErrorText>` 노출.
  - 모든 뮤테이션(저장, 제출, 배팅, 추리, 조커 찬스) 성공 시 `await refresh()` 를 즉시 호출하여 실시간 동기화.
- **네이티브 브라우저 대화상자 배제**:
  - `window.alert`, `window.confirm`, `window.prompt` 일체 사용하지 않고, 인라인 UI 및 접근성 높은 모달/카드 인터랙션 구현.
- **외부 종속성 없음**:
  - 외부 라이브러리 추가 없이 React 19 + Tailwind CSS v4만으로 애니메이션과 인터랙션 구현.

---

## 4. 백엔드 및 타 팀 요청 사항

1. **테스트 데이터 시나리오 검증 요청**:
   - `ACTIVE` 상태에서 관리자가 미션을 오픈했을 때의 카운트다운 및 제출 동작, `GUESSING` 전환 시의 `GuessCard` 노출, `FINISHED` 전환 시 `EndingView` 의 순환 고리 화살표 연결 애니메이션이 실제 Supabase 실시간 신호와 원활히 연동되는지 스모크 테스트 권장합니다.
2. **현재 규격 완벽 준수**:
   - 기존 파일(`src/lib/**`, `src/app/api/**`, `src/components/ui/**`, `package.json` 등)을 전혀 수정하지 않고 계약만으로 구현을 완료하였으며, 추가 백엔드 수정 요구 사항은 없습니다.
