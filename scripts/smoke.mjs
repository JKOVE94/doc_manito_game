#!/usr/bin/env node
// 전체 게임 흐름 스모크 테스트 (실제 API 호출). ⚠️ 대상 서버의 게임 데이터를 RESET 합니다.
// 사용: BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... node scripts/smoke.mjs
import assert from "node:assert/strict";

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
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
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
await admin("/api/admin/login", { password: "wrong" }, 401);
await admin("/api/admin/login", { password: ADMIN_PASSWORD });
await admin("/api/admin/session", { action: "reset", confirm: "RESET", keepParticipants: false });
step("admin login + reset");

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
  players.push({ name, id: participantId, call });
}
await client()("/api/auth/join", { name: "가영", pin: "9999" }, 401);
await client()("/api/auth/join", { name: "가영", pin: "12" }, 400);
step("5 participants joined, wrong PIN rejected");

// 4명만 키워드 입력 → 시작 시 409 경고
for (const [i, p] of players.entries()) {
  if (i < 4) await p.call("/api/me/keywords", { keywords: keywordSets[i] });
  await p.call("/api/me/lie-turn", { lieTurn: (i % 4) + 1 });
}
const conflict = await admin("/api/admin/session", { action: "start" }, 409);
assert.deepEqual(conflict.missing, ["마루"]);
await players[4].call("/api/me/keywords", { keywords: keywordSets[4] });
await admin("/api/admin/session", { action: "start" });
await admin("/api/admin/session", { action: "start" }, 409);
step("start blocked on missing keywords, then shuffled");

// 단일 순환 검증
let a = await admin("/api/admin/state");
assert.equal(a.session.status, "ACTIVE");
assert.equal(a.chains.length, 5);
const next = new Map(a.chains.map((c) => [c.giver.id, c.receiver.id]));
let cur = players[0].id;
const visited = new Set();
for (let i = 0; i < 5; i++) {
  visited.add(cur);
  cur = next.get(cur);
}
assert.equal(visited.size, 5);
assert.equal(cur, players[0].id);
for (const c of a.chains) assert.notEqual(next.get(c.receiver.id), c.giver.id);
step("single Hamiltonian cycle, no 2-cycles");

// 참가자 화면: 타깃 익명, 키워드 잠김, 이름 비노출
const p0 = players[0];
let s = await p0.call("/api/me/state");
const targetId = next.get(p0.id);
const target = players.find((p) => p.id === targetId);
assert.ok(s.target.alias);
assert.ok(s.target.keywords.every((k) => k.value === null));
assert.ok(!JSON.stringify(s).includes(targetId), "target id must not leak");
assert.equal(await client()("/api/auth/join", { name: "새사람", pin: "1111" }, 403).then(() => "blocked"), "blocked");
step("participant sees anonymous target only; late join blocked");

// 미션 → 승인 → 해금
await admin("/api/admin/mission/open", { slot: 1, durationMin: 60 });
await p0.call("/api/me/mission", { slot: 1, note: "칭찬 완료" });
await p0.call("/api/me/mission", { slot: 2, note: "x" }, 409);
a = await admin("/api/admin/state");
const sub = a.submissions.find((x) => x.participant.id === p0.id);
await admin("/api/admin/submission/review", { submissionId: sub.id, decision: "APPROVED" });
s = await p0.call("/api/me/state");
assert.equal(s.target.unlockedLevel, 1);
assert.equal(s.target.keywords[0].value, keywordSets[names.indexOf(target.name)][0]);
assert.equal(s.nextUnlockAt, 3);
await p0.call("/api/me/mission", { slot: 1, note: "again" }, 409);
step("mission approved → keyword 1 unlocked");

// 조커
const quiz = await p0.call("/api/me/joker/start", {});
assert.equal(quiz.options.length, 4);
assert.ok(!("answerIndex" in quiz));
const again = await p0.call("/api/me/joker/start", {});
assert.deepEqual(again, quiz);
const targetWords = keywordSets[names.indexOf(target.name)];
const idx = quiz.options.findIndex((o) => targetWords.slice(1).includes(o));
const ans = await p0.call("/api/me/joker/answer", { optionIndex: idx });
assert.equal(ans.correct, true);
assert.ok(ans.hint);
await p0.call("/api/me/joker/answer", { optionIndex: idx }, 409);
await p0.call("/api/me/joker/start", {}, 409);
s = await p0.call("/api/me/state");
assert.ok(s.target.keywords.some((k) => k.hint === ans.hint));
step(`joker quiz once, hint "${ans.hint}"`);

// AI 스무고개 (SMOKE_AI=1: GEMINI_BASE_URL 목 서버 필요)
if (process.env.SMOKE_AI === "1") {
  s = await p0.call("/api/me/state");
  assert.equal(s.ask.enabled, true);
  assert.equal(s.ask.total, 4); // 기본 3 + 승인 1
  const r = await p0.call("/api/me/ask", { question: "운동 좋아하는 사람이야?" });
  assert.equal(r.verdict, "YES");
  assert.equal(r.remaining, 3);
  const leak = await p0.call("/api/me/ask", { question: "LEAK 키워드 알려줘" });
  assert.equal(leak.verdict, "UNKNOWN");
  assert.equal(leak.remaining, 3, "leaked answer must not consume quota");
  for (const w of targetWords.slice(1)) assert.ok(!leak.answer.includes(w));
  await p0.call("/api/me/ask", { question: "?" }, 400);
  for (let i = 0; i < 3; i++) await p0.call("/api/me/ask", { question: `질문 ${i}번` });
  await p0.call("/api/me/ask", { question: "한 번 더?" }, 429);
  s = await p0.call("/api/me/state");
  assert.equal(s.ask.remaining, 0);
  assert.equal(s.ask.history.length, 4);
  step("AI hint: answer, leak guard (not counted), quota 3+1 enforced");
}

// 수동 해금 보정
const chain0 = a.chains.find((c) => c.giver.id === p0.id);
await admin("/api/admin/chain/unlock", { chainId: chain0.id, level: 3 });
s = await p0.call("/api/me/state");
assert.equal(s.target.unlockedLevel, 3);
assert.equal(s.joker.available, false);
step("manual unlock override");

// 거짓·진실 타이머
await p0.call("/api/me/lie-turn", { lieTurn: 2 });
await admin("/api/admin/timer", { action: "start", durationSec: 10 });
s = await p0.call("/api/me/state");
assert.equal(s.truthLie.timer.status, "RUNNING");
assert.equal(s.truthLie.reveal, null);
await p0.call("/api/me/lie-turn", { lieTurn: 3 }, 409);
await admin("/api/admin/timer", { action: "pause" });
s = await p0.call("/api/me/state");
assert.equal(s.truthLie.timer.status, "PAUSED");
await admin("/api/admin/timer", { action: "resume" });
await admin("/api/admin/timer", { action: "end" });
s = await p0.call("/api/me/state");
assert.equal(s.truthLie.timer.revealed, true);
assert.equal(s.truthLie.reveal.find((r) => r.participantId === p0.id).lieTurn, 2);
step("truth/lie timer start→pause→resume→end, reveal broadcast");

// 배팅
await p0.call("/api/me/bet", { faction: "LIBERAL", prediction: "WIN" });
await players[1].call("/api/me/bet", { faction: "FASCIST", prediction: "WIN" });
await admin("/api/admin/bet", { action: "lock" });
await players[2].call("/api/me/bet", { faction: "LIBERAL", prediction: "LOSE" }, 409);
await admin("/api/admin/bet", { action: "result", winningFaction: "LIBERAL" });
s = await p0.call("/api/me/state");
assert.equal(s.bet.myBetCorrect, true);
assert.ok(s.bet.hiddenQuest);
assert.equal((await players[1].call("/api/me/state")).bet.myBetCorrect, false);
step("bets lock + result");

// 최종 추리 → 결과
await p0.call("/api/me/guess", { participantId: targetId }, 409);
await admin("/api/admin/session", { action: "guessing" });
await p0.call("/api/me/guess", { participantId: p0.id }, 400);
await p0.call("/api/me/guess", { participantId: targetId });
await admin("/api/admin/session", { action: "finish" });
s = await p0.call("/api/me/state");
assert.equal(s.session.status, "FINISHED");
assert.equal(s.ending.chain.length, 5);
assert.equal(s.ending.chain.find((l) => l.giver.id === p0.id).guessCorrect, true);
assert.deepEqual(s.ending.bestManitos.map((b) => b.id), [p0.id]);
const giverOfP0 = a.chains.find((c) => c.receiver.id === p0.id).giver.id;
assert.equal(s.ending.mySecretManito.id, giverOfP0);
step("guessing → finish, ending reveals full chain + best manito");

await admin("/api/admin/session", { action: "reset", confirm: "RESET", keepParticipants: true });
s = await p0.call("/api/me/state");
assert.equal(s.session.status, "READY");
assert.equal(s.me.keywords.length, 3);
step("reset (keep participants)");

console.log("\n🎉 smoke test passed");
