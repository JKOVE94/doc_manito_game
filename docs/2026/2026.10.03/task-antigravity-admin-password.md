# task-antigravity-admin-password.md — 관리자 비밀번호 최초 설정/변경 UI

프로젝트 루트: `/Users/jkove/orca/doc_manito_game`. 먼저 읽을 것:
- `docs/2026/2026.09.29/api-contract.md` 맨 아래 "관리자 비밀번호 DB 관리" 섹션
- 네가 만든 `src/app/admin/page.tsx`, `src/components/admin/DangerZone.tsx`

## 파일 소유권
- 수정: `src/app/admin/page.tsx`
- 신규: `src/components/admin/AdminPasswordCard.tsx`
- 그 외 금지. `npm install`/`next build`/`next dev` 금지. 검증 `npx tsc --noEmit -p .`, `npx eslint src/app/admin src/components/admin` 0 에러.

## 명세
1. **로그인 화면 (401 상태)**: 마운트 시 `api<{ needsSetup: boolean }>("/api/admin/status")`.
   - `needsSetup === true` → "🔐 관리자 비밀번호 만들기" 폼: 비밀번호 + 비밀번호 확인 (4자 이상, 일치 검사), 안내 "처음 한 번만 설정해요. 이 비밀번호로 호스트 콘솔에 들어와요." 제출 → `api("/api/admin/setup", { password })` → `await refresh()`.
   - 아니면 기존 비밀번호 로그인 폼 그대로.
2. **AdminPasswordCard** (콘솔, DangerZone 바로 위 `lg:col-span-2` 또는 DangerZone 옆): "🔑 관리자 비밀번호 변경" — 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인 → `api("/api/admin/password", { currentPassword, newPassword })`. 성공 시 "변경됐어요. 다른 기기의 관리자 로그인은 자동으로 로그아웃돼요." 표시 후 입력 초기화 + `await refresh()`.
- loading / ErrorText / `window.alert/confirm` 금지, 360px 가로 스크롤 금지, input type=password.

## 완료 보고
`docs/2026/2026.10.03/report-antigravity-admin-password.md`
