#!/usr/bin/env node
// 전체 게임 흐름 스모크 테스트 v2 (실제 API 호출). ⚠️ 대상 서버의 게임 데이터를 RESET 합니다. 로컬 DB 에서만 실행하세요.
// 사용: BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... [SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=...] [SMOKE_AI=1] node scripts/smoke.mjs
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD 환경변수가 필요합니다.");

function client() {
  let cookie = "";
  return async function call(path, body, expectStatus = 200) {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      cookie = [...cookie.split("; ").filter((x) => x && !x.startsWith(name + "=")), pair].join("; ");
    }
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, expectStatus, `${path} → ${res.status} ${JSON.stringify(data)}`);
    return data;
  };
}
const step = (msg) => console.log(`✔ ${msg}`);

const admin = client();
await admin("/api/admin/state", undefined, 401);
await admin("/api/admin/login", { password: ADMIN_PASSWORD });
await admin("/api/admin/session", { action: "reset", confirm: "RESET", keepParticipants: false });
step("admin login + reset");

// 관리자 비밀번호 DB 관리: 변경 시 다른 기기 세션 만료
assert.equal((await client()("/api/admin/status")).needsSetup, false);
await client()("/api/admin/setup", { password: "hijack" }, 409); // 이미 설정됨 → 탈취 불가
const otherDevice = client();
await otherDevice("/api/admin/login", { password: ADMIN_PASSWORD });
await admin("/api/admin/password", { currentPassword: "wrong", newPassword: "temp-pass" }, 401);
await admin("/api/admin/password", { currentPassword: ADMIN_PASSWORD, newPassword: "temp-pass" });
await otherDevice("/api/admin/state", undefined, 401);
await admin("/api/admin/state"); // 변경한 기기는 유지
await client()("/api/admin/login", { password: ADMIN_PASSWORD }, 401);
await admin("/api/admin/password", { currentPassword: "temp-pass", newPassword: ADMIN_PASSWORD });
step("admin password in DB: change invalidates other sessions, setup can't hijack");

const names = ["가영", "나래", "다솜", "라희", "마루"];
const keywordSets = [
  ["피아노", "러닝", "요리"],
  ["축구", "베이킹", "기타"],
  ["여행", "캠핑", "노래"],
  ["독서", "사진", "그림"],
  ["등산", "게임", "춤"],
];
const players = [];
for (const [i, name] of names.entries()) {
  const call = client();
  const { participantId } = await call("/api/auth/join", { name, pin: `100${i}` });
  players.push({ name, id: participantId, call, kw: keywordSets[i] });
}
await client()("/api/auth/join", { name: "가영", pin: "9999" }, 401);
let a;
// 준비 흐름: 거짓말 순번은 선택 사항. 키워드 저장 후 [준비], 수정하면 준비 해제, 키워드 없이는 준비 불가
await players[4].call("/api/me/ready", { ready: true }, 409);
for (const [i, p] of players.entries()) {
  if (i < 4) {
    await p.call("/api/me/keywords", { keywords: p.kw });
    await p.call("/api/me/ready", { ready: true });
  }
}
let st = await players[0].call("/api/me/state");
assert.equal(st.me.isReady, true);
assert.equal(st.session.readyCount, 4);
assert.equal(st.me.lieTurn, null, "lie turn is optional");
await players[0].call("/api/me/keywords", { keywords: players[0].kw }); // 수정 → 준비 해제
assert.equal((await players[0].call("/api/me/state")).me.isReady, false);
await players[0].call("/api/me/ready", { ready: true });
a = await admin("/api/admin/state");
assert.equal(a.session.readyCount, 4);
assert.equal(a.participants.find((x) => x.name === "마루").isReady, false);
assert.deepEqual((await admin("/api/admin/session", { action: "start" }, 409)).missing, ["마루"]);
await players[4].call("/api/me/keywords", { keywords: players[4].kw });
await players[4].call("/api/me/ready", { ready: true });
// 거짓말 순번은 게임 시작 후 거짓·진실 탭에서 설정
for (const [i, p] of players.entries()) await p.call("/api/me/lie-turn", { lieTurn: (i % 4) + 1 });
step("ready flow: lie turn optional, edit un-readies, can't ready without keywords, host sees who's missing");

// TMI 데이터 (게임 전 업로드)
const tmiLines = [
  "가영: 초등학생 때 전국 줄넘기 대회 3등",
  "나래 | 매운 음식 하나도 못 먹음",
  "다솜\t고양이 세 마리 집사",
  "라희: 새벽 5시 기상 3년째",
  "마 루: 군대에서 취사병",
  "외부인: 퀴즈에 나오면 안 됨",
];
const tmiRes = await admin("/api/admin/tmi", { text: tmiLines.join("\n") });
assert.equal(tmiRes.factCount, 6);
a = await admin("/api/admin/state");
assert.equal(a.tmi.subjects.find((s) => s.name === "마 루").matched, true);
assert.equal(a.tmi.subjects.find((s) => s.name === "외부인").matched, false);
step("TMI import (lines/pipe/tab, space-insensitive name match, unmatched flagged)");

await admin("/api/admin/session", { action: "start" });
a = await admin("/api/admin/state");

// 미션 랜덤 자동 오픈: 시작 5~15분 뒤 첫 미션 예약 → 예약 시각이 지나면 다음 요청 때 오픈
assert.equal(a.session.missionAuto, true);
const firstIn = (Date.parse(a.session.nextMissionAt) - Date.parse(a.serverNow)) / 60_000;
assert.ok(firstIn >= 4.9 && firstIn <= 15.1, `first mission in 5~15 min (got ${firstIn.toFixed(1)})`);
assert.equal(a.missions.filter((m) => m.openedAt).length, 0);
if (process.env.DB_URL) {
  const { default: pg } = await import("node:child_process");
  const psql = (sql) => pg.execFileSync("docker", ["exec", "supabase_db_doc_manito_game", "psql", "-U", "postgres", "-tAc", sql]).toString().trim();
  psql("update game_sessions set next_mission_at = now() - interval '1 second' where code='main'");
  a = await admin("/api/admin/state"); // 어떤 조회든 스케줄러 실행
  assert.deepEqual(a.missions.filter((m) => m.openedAt).map((m) => m.slot), [1], "slot 1 auto-opened");
  const m1 = a.missions[0];
  assert.equal(Math.round((Date.parse(m1.deadline) - Date.parse(m1.openedAt)) / 60_000), 30, "30 min limit");
  const gap = (Date.parse(a.session.nextMissionAt) - Date.parse(a.serverNow)) / 60_000;
  assert.ok(gap >= 24.9 && gap <= 35.1, `next in 25~35 min (got ${gap.toFixed(1)})`);
  // 동시 요청이 와도 한 번만 오픈
  psql("update game_sessions set next_mission_at = now() - interval '1 second' where code='main'");
  await Promise.all([admin("/api/admin/state"), admin("/api/admin/state"), admin("/api/admin/state"), admin("/api/admin/state")]);
  a = await admin("/api/admin/state");
  assert.deepEqual(a.missions.filter((m) => m.openedAt).map((m) => m.slot), [1, 2], "concurrent checks open exactly one slot");
  // 끄면 예약 해제, 다음 미션 지금 열기
  await admin("/api/admin/mission/auto", { enabled: false });
  a = await admin("/api/admin/state");
  assert.equal(a.session.missionAuto, false);
  assert.equal(a.session.nextMissionAt, null);
  await admin("/api/admin/mission/auto", { action: "open-next" });
  a = await admin("/api/admin/state");
  assert.deepEqual(a.missions.filter((m) => m.openedAt).map((m) => m.slot), [1, 2, 3]);
  assert.equal(a.session.nextMissionAt, null, "stays off after manual open when auto is off");
  await admin("/api/admin/mission/auto", { enabled: true });
  assert.ok((await admin("/api/admin/state")).session.nextMissionAt, "re-enabled → scheduled");
  step("mission random auto-open: first 5~15m, then 25~35m, 30m limit, one slot even with concurrent requests, toggle/open-next");
} else {
  step("mission auto-open scheduled 5~15m after start (set DB_URL=1 to test the scheduler)");
}
const next = new Map(a.chains.map((c) => [c.giver.id, c.receiver.id]));
const prev = new Map(a.chains.map((c) => [c.receiver.id, c.giver.id]));
let cur = players[0].id;
const seen = new Set();
for (let i = 0; i < 5; i++) (seen.add(cur), (cur = next.get(cur)));
assert.equal(seen.size, 5);
for (const c of a.chains) assert.notEqual(next.get(c.receiver.id), c.giver.id);
step("single cycle, no 2-cycles");

// 두 관계: 내가 섬기는 사람(이름 공개) / 나를 섬기는 비밀 마니또(비공개)
const p0 = players[0];
const byId = new Map(players.map((p) => [p.id, p]));
const target = byId.get(next.get(p0.id));
const giver = byId.get(prev.get(p0.id));
let s = await p0.call("/api/me/state");
assert.equal(s.target.name, target.name);
assert.deepEqual(s.target.keywords.map((k) => k.value), target.kw);
assert.equal(s.manito.unlockedLevel, 0);
assert.equal(s.manito.maxLevel, 5);
assert.ok(s.manito.hints.every((h) => h.value === null));
const raw = JSON.stringify({ ...s, roster: undefined }); // roster 는 전원 이름 목록(관계 정보 없음)
assert.ok(!raw.includes(giver.id) && !raw.includes(giver.name), "secret manito must not leak");
step(`two relations: serve ${target.name} (named) / secret manito hidden`);

// 수시 퀴즈 → 정답 시 힌트 포인트 +1 → 비밀 마니또 힌트 1단계
assert.equal(s.quiz.pending, null);
await admin("/api/admin/quiz", { action: "send-now" });
s = await p0.call("/api/me/state");
const q = s.quiz.pending;
assert.ok(q, "quiz should be generated on next state fetch");
assert.equal(q.options.length, 4);
assert.ok(!q.question.includes("외부인") && !q.question.includes("줄넘기"), "no unmatched / self TMI");
const factToName = tmiLines.map((l) => {
  const [n, ...rest] = l.split(/\s*[:|\t]\s*/);
  return { name: n.replace(/\s/g, ""), fact: rest.join(" ").trim() };
});
const subject = factToName.find((f) => q.question.includes(f.fact)).name;
const qr = await p0.call("/api/me/quiz/answer", { quizId: q.id, optionIndex: q.options.indexOf(subject) });
assert.equal(qr.correct, true);
assert.equal(qr.score, 1);
await p0.call("/api/me/quiz/answer", { quizId: q.id, optionIndex: 0 }, 409);
s = await p0.call("/api/me/state");
assert.equal(s.quiz.pending, null);
assert.equal(s.manito.points, 1);
assert.equal(s.manito.unlockedLevel, 1);
assert.equal(s.manito.hints[0].value, giver.kw[0]);
assert.equal(s.manito.nextUnlockAt, 3);
step(`random TMI quiz answered (${subject}) → hint level 1 = "${giver.kw[0]}"`);

// 미션 사진 인증
await admin("/api/admin/mission/open", { slot: 1, durationMin: 60 });
await p0.call("/api/me/mission", { slot: 1, note: "" }, 400);
await p0.call("/api/me/mission", { slot: 1, note: "", photoPath: "other/x.jpg" }, 400);
let photoPath = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
  const up = await p0.call("/api/me/mission/upload-url", { contentType: "image/png" });
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const { error } = await sb.storage.from(up.bucket).uploadToSignedUrl(up.path, up.token, png, { contentType: "image/png" });
  assert.equal(error, null, error?.message);
  photoPath = up.path;
  // 비공개 버킷: 공개 키로 직접 읽기 불가
  const { data: leaked } = await sb.storage.from(up.bucket).download(up.path);
  assert.equal(leaked, null, "photo must not be readable with the publishable key");
}
await p0.call("/api/me/mission", { slot: 1, note: "음료 배달 완료", photoPath });
a = await admin("/api/admin/state");
const sub = a.submissions.find((x) => x.participant.id === p0.id);
if (photoPath) {
  assert.ok(sub.photoUrl);
  assert.equal((await fetch(sub.photoUrl)).status, 200);
}
await admin("/api/admin/submission/review", { submissionId: sub.id, decision: "APPROVED" });
s = await p0.call("/api/me/state");
assert.equal(s.manito.points, 2);
assert.deepEqual(s.manito.pointSources, { missions: 1, quizzes: 1 });
assert.equal(s.manito.unlockedLevel, 1);
if (photoPath) assert.ok(s.missions[0].mySubmission.photoUrl);
step(photoPath ? "mission photo upload (private bucket, signed URL) + approval → points 2" : "mission (no storage env, photo skipped) → points 2");

// 자리비움: 마감 연장 + 퀴즈 중단
await admin("/api/admin/mission/open", { slot: 2, durationMin: 1 });
await admin("/api/admin/quiz", { action: "send-now" });
assert.ok((await p0.call("/api/me/state")).quiz.pending, "quiz pending before away");
await p0.call("/api/me/away", { away: true });
s = await p0.call("/api/me/state");
assert.ok(s.me.awaySince);
assert.equal(s.quiz.pending, null, "pending quiz cancelled while away");
const m2 = s.missions.find((x) => x.slot === 2);
assert.ok(m2.graceSec >= 600, "grace includes 10 min return buffer");
assert.ok(Date.parse(m2.myDeadline) > Date.parse(m2.deadline));
await admin("/api/admin/mission/close", { slot: 2 }); // 공통 마감 지남
s = await p0.call("/api/me/state");
assert.equal(s.missions.find((x) => x.slot === 2).isActive, true, "still open for the away person");
assert.equal((await players[1].call("/api/me/state")).missions.find((x) => x.slot === 2).isActive, false);
await p0.call("/api/me/mission", { slot: 2, note: "복귀 후 제출" });
await admin("/api/admin/away", { participantId: p0.id, away: false });
assert.equal((await p0.call("/api/me/state")).me.awaySince, null);
a = await admin("/api/admin/state");
assert.equal(a.participants.find((x) => x.id === p0.id).awaySince, null);
await admin("/api/admin/away", { participantId: players[1].id, away: true });
assert.ok((await admin("/api/admin/state")).participants.find((x) => x.id === players[1].id).awaySince);
await admin("/api/admin/away", { participantId: players[1].id, away: false });
step("away: quiz paused, personal deadline extended past close (+10min buffer), admin toggle");

// 질문 우편함
const tgt = players.find((p) => p.id === target.id);
const gv = players.find((p) => p.id === giver.id);
for (let i = 1; i <= 3; i++) await p0.call("/api/me/mail/send", { to: "TARGET", question: `질문 ${i}: 좋아하는 간식은?` });
await p0.call("/api/me/mail/send", { to: "TARGET", question: "4번째" }, 429);
let ts = await tgt.call("/api/me/state");
const fromManito = ts.mailbox.inbox.filter((m) => m.from === "MY_MANITO");
assert.equal(fromManito.length, 3);
assert.ok(fromManito.every((m) => m.fromLabel.includes("비밀 마니또")));
assert.ok(!JSON.stringify(ts.mailbox).includes(p0.name), "target must not learn who asked");
await tgt.call("/api/me/mail/answer", { mailId: fromManito[0].id, answer: "초코우유!" });
await tgt.call("/api/me/mail/answer", { mailId: fromManito[0].id, answer: "again" }, 409);
await p0.call("/api/me/mail/answer", { mailId: fromManito[1].id, answer: "hack" }, 400);
await p0.call("/api/me/mail/send", { to: "MANITO", question: "혹시 찬양팀이세요?" });
const gs = await gv.call("/api/me/state");
const fromTarget = gs.mailbox.inbox.find((m) => m.from === "MY_TARGET");
assert.equal(fromTarget.fromLabel, p0.name);
await gv.call("/api/me/mail/answer", { mailId: fromTarget.id, answer: "비밀이에요 😉" });
s = await p0.call("/api/me/state");
assert.ok(s.mailbox.toTarget.items.some((m) => m.answer === "초코우유!"));
assert.equal(s.mailbox.toTarget.remaining, 0);
assert.equal(s.mailbox.toManito.items[0].answer, "비밀이에요 😉");
step("mailbox: 3/3 to target (anonymous), to manito (named), answers once, only recipient can answer");

// 조커: 비밀 마니또의 잠긴 키워드
const jq = await p0.call("/api/me/joker/start", {});
const jIdx = jq.options.findIndex((o) => giver.kw.slice(1).includes(o));
assert.ok(jIdx >= 0);
const ja = await p0.call("/api/me/joker/answer", { optionIndex: jIdx });
assert.equal(ja.correct, true);
s = await p0.call("/api/me/state");
assert.ok(s.manito.hints.some((h) => h.hint === ja.hint));
step(`joker on secret manito keyword → hint "${ja.hint}"`);

// AI 스무고개 (SMOKE_AI=1: GEMINI_BASE_URL 목 서버 필요)
if (process.env.SMOKE_AI === "1") {
  s = await p0.call("/api/me/state");
  const total = s.ask.total;
  const r1 = await p0.call("/api/me/ask", { question: "단 거 좋아해?", about: "TARGET" });
  const r2 = await p0.call("/api/me/ask", { question: "운동 좋아해?", about: "MANITO" });
  assert.equal(r1.about, "TARGET");
  assert.equal(r2.remaining, total - 2, "quota is shared");
  step("AI ask about TARGET + MANITO share one quota");
}

// 수동 보정 → 이름 힌트까지
const recvChain = a.chains.find((c) => c.receiver.id === p0.id);
await admin("/api/admin/chain/unlock", { chainId: recvChain.id, level: 5 });
s = await p0.call("/api/me/state");
assert.equal(s.manito.hints[3].value, `${giver.name.length}글자`);
assert.ok(s.manito.hints[4].value.length === giver.name.length);
step(`manual unlock 5 → "${s.manito.hints[3].value}", "${s.manito.hints[4].value}"`);

// 타이머 / 배팅
await admin("/api/admin/timer", { action: "start", durationSec: 10 });
await p0.call("/api/me/lie-turn", { lieTurn: 3 }, 409);
await admin("/api/admin/timer", { action: "end" });
assert.equal((await p0.call("/api/me/state")).truthLie.timer.revealed, true);
await p0.call("/api/me/bet", { faction: "LIBERAL", prediction: "WIN" });
await admin("/api/admin/bet", { action: "result", winningFaction: "LIBERAL" });
assert.equal((await p0.call("/api/me/state")).bet.myBetCorrect, true);
step("truth/lie timer + bets");

// 최종 추리: 나를 섬긴 비밀 마니또 지목
await admin("/api/admin/session", { action: "guessing" });
await p0.call("/api/me/guess", { participantId: target.id });
s = await p0.call("/api/me/state");
assert.equal(s.guess.myGuess.id, target.id);
await p0.call("/api/me/guess", { participantId: giver.id });
await admin("/api/admin/session", { action: "finish" });
s = await p0.call("/api/me/state");
assert.equal(s.ending.mySecretManito.id, giver.id);
assert.equal(s.ending.chain.find((l) => l.receiver.id === p0.id).guessCorrect, true);
assert.deepEqual(s.ending.bestManitos.map((b) => b.id), [p0.id]);
step("guess my secret manito → correct; ending + best manito");

// 🧪 테스트 모드: 실제 1명 + 봇 3명
await admin("/api/admin/session", { action: "reset", confirm: "RESET", keepParticipants: false });
a = await admin("/api/admin/state");
assert.equal(a.tmi.factCount, 6, "TMI survives reset");
const solo = client();
const { participantId: soloId } = await solo("/api/auth/join", { name: "가영", pin: "4321" });
await solo("/api/me/keywords", { keywords: ["피아노", "러닝", "요리"] });
await admin("/api/admin/test/bots", { action: "add", count: 3 });
assert.deepEqual((await admin("/api/admin/session", { action: "start" }, 409)).missing, ["가영"], "bots are auto-ready; only the real player is missing");
await solo("/api/me/ready", { ready: true });
await admin("/api/admin/test/impersonate", { participantId: soloId }, 409);
await admin("/api/admin/session", { action: "start" });
await admin("/api/admin/mission/open", { slot: 1, durationMin: 30 });
s = await solo("/api/me/state");
await solo("/api/me/mail/send", { to: "TARGET", question: "봇아 안녕?" });
const act = await admin("/api/admin/test/act", {});
assert.match(act.summary, /미션 제출 3건 · 배팅 3건 · 퀴즈 \d건 · 답장 1건/);
s = await solo("/api/me/state");
assert.ok(s.mailbox.toTarget.items[0].answer?.includes("봇"));
await admin("/api/admin/session", { action: "guessing" });
assert.match((await admin("/api/admin/test/act", {})).summary, /최종 추리 3건/);
await admin("/api/admin/session", { action: "finish" });
assert.equal((await solo("/api/me/state")).ending.chain.length, 4);
await admin("/api/admin/session", { action: "reset", confirm: "RESET", keepParticipants: true });
a = await admin("/api/admin/state");
assert.equal(a.botCount, 0);
step(`test mode: 1 real + 3 bots (${act.summary})`);

console.log("\n🎉 smoke test v2 passed");
