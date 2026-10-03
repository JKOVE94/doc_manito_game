import "server-only";
import { randomInt } from "node:crypto";
import { BOT_KEYWORD_POOL, KEYWORD_SLOTS } from "@/lib/config";
import { getInitialConsonants } from "@/lib/game/choseong";
import type { BotActResult } from "@/lib/types";
import { hashPin, setParticipantCookie } from "./auth";
import { botAnswerMails } from "./mail";
import { botAnswerQuizzes } from "./quiz";
import { badRequest, conflict } from "./http";
import { bump, getSession, isMissionActive, listBets, listChains, listMissions, listParticipants, listSubmissions } from "./repo";
import { db, must } from "./supabase";

const pick = <T,>(arr: readonly T[]): T => arr[randomInt(arr.length)];

/** 🧪 봇 참가자 추가 (키워드 3개 + 거짓말 순번 자동 입력) */
export async function addBots(count: number): Promise<void> {
  const session = await getSession();
  if (session.status !== "READY") throw conflict("봇은 게임 시작 전에만 추가할 수 있어요.");
  const existing = await listParticipants(session.id);
  const names = new Set(existing.map((p) => p.name));

  const rows = [];
  for (let n = 1; rows.length < count; n++) {
    const name = `🤖봇${n}`;
    if (names.has(name)) continue;
    // 봇은 PIN 로그인 불가 (무작위 해시) — 호스트 콘솔 '봇으로 보기'로만 접속
    rows.push({ session_id: session.id, name, is_bot: true, pin_hash: await hashPin(String(randomInt(1e9))) });
  }
  const bots = must(
    await db().from("participants").insert(rows).select("id"),
    "insert bots",
  ) as { id: string }[];

  must(
    await db()
      .from("user_keywords")
      .insert(
        bots.flatMap((b) =>
          KEYWORD_SLOTS.map(({ slot }) => {
            const value = pick(BOT_KEYWORD_POOL[slot - 1]);
            return { participant_id: b.id, slot_index: slot, keyword_value: value, initial_consonants: getInitialConsonants(value) };
          }),
        ),
      ),
    "insert bot keywords",
  );
  must(
    await db()
      .from("truth_lie_settings")
      .insert(bots.map((b) => ({ session_id: session.id, participant_id: b.id, lie_turn: randomInt(1, 5) }))),
    "insert bot lie turns",
  );
  await bump(session.id);
}

export async function removeBots(): Promise<void> {
  const session = await getSession();
  if (session.status !== "READY") throw conflict("게임 시작 후에는 봇을 삭제할 수 없어요. (매칭 고리가 끊어짐) RESET 을 사용하세요.");
  must(await db().from("participants").delete().eq("session_id", session.id).eq("is_bot", true), "remove bots");
  await bump(session.id);
}

/** 🧪 봇 전원이 현재 단계에서 할 수 있는 행동을 수행 */
export async function botsAct(): Promise<BotActResult> {
  const session = await getSession();
  if (session.status !== "ACTIVE" && session.status !== "GUESSING") {
    throw conflict("봇 자동 행동은 게임 진행 중/최종 추리 단계에서만 가능해요.");
  }
  const participants = await listParticipants(session.id);
  const bots = participants.filter((p) => p.is_bot);
  if (bots.length === 0) throw badRequest("봇 참가자가 없어요.");

  const [missions, chains, bets] = await Promise.all([
    listMissions(session.id),
    listChains(session.id),
    listBets(session.id),
  ]);
  const submissions = await listSubmissions(missions.map((m) => m.id));
  let missionCount = 0;
  let betCount = 0;
  let guessCount = 0;

  if (session.status === "ACTIVE") {
    const submitted = new Set(submissions.map((s) => `${s.mission_id}:${s.participant_id}`));
    const rows = missions
      .filter((m) => isMissionActive(m))
      .flatMap((m) => bots.filter((b) => !submitted.has(`${m.id}:${b.id}`)).map((b) => ({ mission_id: m.id, participant_id: b.id, note: "🤖 봇 자동 제출" })));
    if (rows.length) must(await db().from("mission_submissions").insert(rows), "bot missions");
    missionCount = rows.length;
  }

  if (session.bet_status === "OPEN") {
    const hasBet = new Set(bets.map((b) => b.participant_id));
    const rows = bots
      .filter((b) => !hasBet.has(b.id))
      .map((b) => ({
        session_id: session.id,
        participant_id: b.id,
        faction: pick(["LIBERAL", "FASCIST"] as const),
        prediction: pick(["WIN", "LOSE"] as const),
      }));
    if (rows.length) must(await db().from("faction_bets").insert(rows), "bot bets");
    betCount = rows.length;
  }

  if (session.status === "GUESSING") {
    for (const b of bots) {
      const chain = chains.find((c) => c.receiver_id === b.id);
      if (!chain || chain.final_guess_id) continue;
      const guess = pick(participants.filter((p) => p.id !== b.id)).id;
      must(
        await db()
          .from("manito_chains")
          .update({ final_guess_id: guess, is_guess_correct: guess === chain.giver_id })
          .eq("id", chain.id),
        "bot guess",
      );
      guessCount++;
    }
  }

  let quizCount = 0;
  let mailCount = 0;
  if (session.status === "ACTIVE") quizCount = await botAnswerQuizzes(session, bots);
  mailCount = await botAnswerMails(session.id, new Set(bots.map((b) => b.id)));

  await bump(session.id);
  return {
    ok: true,
    summary: `미션 제출 ${missionCount}건 · 배팅 ${betCount}건 · 퀴즈 ${quizCount}건 · 답장 ${mailCount}건 · 최종 추리 ${guessCount}건`,
  };
}

/** 🧪 호스트가 봇 화면으로 접속 (실제 참가자는 불가 — 파티 중 타깃 엿보기 방지) */
export async function impersonateBot(participantId: string): Promise<void> {
  const session = await getSession();
  const bot = (await listParticipants(session.id)).find((p) => p.id === participantId);
  if (!bot) throw badRequest("참가자를 찾을 수 없어요.");
  if (!bot.is_bot) throw conflict("실제 참가자 화면으로는 접속할 수 없어요. 봇만 가능합니다.");
  await setParticipantCookie(bot.id);
}
