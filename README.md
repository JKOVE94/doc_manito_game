<<<<<<< HEAD
# doc_manito_game
=======
# 대현목장 시크릿 마니또 🎁

10월 3일 마니또 파티용 모바일 웹앱 — 단일 순환 마니또 매칭, 시간제 미션 & 키워드 해금, 조커 퀴즈,
AI 스무고개 힌트(Gemini), 거짓·진실 게임 타이머, 시크릿 히틀러 배팅, 엔딩 순환 고리 공개.

- 참가자: `/` (이름 + PIN 4자리) → `/play`
- 호스트: `/admin` (환경변수 `ADMIN_PASSWORD`)

기획/설계 문서: [`docs/2026/2026.09.29/`](docs/2026/2026.09.29/work-tracker.md)

## 배포 (Vercel + Supabase)

1. **Supabase** 프로젝트 생성 → SQL Editor 에 [`supabase/schema.sql`](supabase/schema.sql) 전체 실행 (재실행 안전).
2. Project Settings > API 에서 URL / anon key / service_role key 확인.
3. **Vercel** 에 이 저장소 import → Environment Variables 에 `.env.example` 항목 입력 → Deploy.
   - `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey)) 를 넣으면 AI 스무고개 힌트 활성화. 비우면 기능만 꺼짐.
   - `SESSION_SECRET`: `openssl rand -base64 32`
4. 배포 URL 의 `/admin` 접속해 로그인 → 참가자에게 `/` 링크(또는 QR) 공유.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

로컬 Supabase(Docker) 사용 시: `npx supabase start` → 출력된 API URL / anon / service_role 키를 `.env.local` 에.
(`supabase/migrations/` 에 스키마가 들어 있어 자동 적용됨)

```bash
npm test          # 매칭/초성/퀴즈/닉네임/AI 유출필터 유닛 테스트
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... node scripts/smoke.mjs   # 실제 API 풀게임 (⚠️ 데이터 RESET)
npm run typecheck
npm run lint
```

## 당일 진행 순서 (호스트)

| 시점 | 호스트 콘솔 작업 | 참가자 화면 |
|---|---|---|
| 입장 | 참가자 현황에서 키워드 3/3 입력 확인 | 이름+PIN 등록 → 키워드 3종 · 거짓말 순번 입력 |
| 시작 | **마니또 셔플 & 게임 시작** (4명 이상) | 익명 타깃 카드 표시 |
| 매 시간 | 미션 슬롯 **오픈**(기본 60분) → 제출 **승인/반려** | 미션 완료 보고 → 승인 누적 1·3·5개마다 키워드 해금 |
| 상시 | (AI 키 설정 시) 별도 조작 없음 | 🔮 AI 스무고개: 타깃에 대해 자연어 질문 (3회 + 승인 미션당 1회) |
| 레크 1 | 거짓·진실 타이머 **시작**(15분) → 종료 시 자동 공개 | 카운트다운 → 전원 거짓말 순번 공개 |
| 레크 2 | 배팅 **잠금** → 게임 후 승리 진영 **결과 발표** | 진영 배팅 + 히든 퀘스트 |
| 17:00 | **최종 추리 오픈** → **결과 공개** | 타깃 지목 → 순환 고리 애니메이션 · 베스트 마니또 |

- 리허설 후엔 **Danger Zone → RESET** (참가자 유지 옵션 가능).
- 해금 기준(`[1,3,5]`), 미션 기본 문구, 히든 퀘스트 카드는 [`src/lib/config.ts`](src/lib/config.ts) 에서 수정.

## 보안 모델

모든 테이블 RLS ON · 정책 없음 → 브라우저의 anon 키로는 매칭/키워드를 읽을 수 없음.
데이터는 서버 Route Handler 가 service_role 로만 접근하며, 참가자별로 필요한 정보만 가공해 응답.
`game_sessions` 만 anon 읽기 허용(비밀 정보 없음) → Realtime 변경 신호로 사용.
>>>>>>> 0ed298d (feat: 대현목장 시크릿 마니또 파티 웹앱)
