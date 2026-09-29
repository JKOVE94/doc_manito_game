import "server-only";
import { KEYWORD_SLOTS } from "@/lib/config";
import { getHint, getInitialConsonants } from "@/lib/game/choseong";
import { buildQuizOptions } from "@/lib/game/quiz";
import type { Faction, JokerQuizView, Prediction } from "@/lib/types";
import { hashPin, verifyPin } from "./auth";
import { badRequest, conflict, HttpError, unauthorized } from "./http";
import {
  bump,
  type ChainRow,
  getChainByGiver,
  getSession,
  type HintQuiz,
  isMissionActive,
  listKeywords,
  listMissions,
  listParticipants,
  type ParticipantRow,
  type SessionRow,
} from "./repo";
import { db, must } from "./supabase";

const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

async function loadMe(participantId: string): Promise<{ session: SessionRow; me: ParticipantRow }> {
  const session = await getSession();
  const me = must(
    await db()
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .eq("session_id", session.id)
      .maybeSingle<ParticipantRow>(),
    "load me",
  );
  if (!me) throw unauthorized("세션이 초기화되었어요. 다시 입장해 주세요.");
  return { session, me };
}

async function requireChain(session: SessionRow, me: ParticipantRow): Promise<ChainRow> {
  if (session.status === "READY") throw conflict("아직 게임이 시작되지 않았어요.");
  const chain = await getChainByGiver(session.id, me.id);
  if (!chain) throw conflict("이번 게임의 매칭에 포함되어 있지 않아요. 호스트에게 문의하세요.");
  return chain;
}

// ---------------------------------------------------------------- 입장
export async function join(rawName: string, pin: string): Promise<{ participantId: string }> {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!/^\d{4}$/.test(pin)) throw badRequest("PIN은 숫자 4자리여야 해요.");
  const session = await getSession();

  const existing = must(
    await db()
      .from("participants")
      .select("*")
      .eq("session_id", session.id)
      .eq("name", name)
      .maybeSingle<ParticipantRow>(),
    "find participant",
  );

  if (existing) {
    if (existing.locked_until && new Date(existing.locked_until).getTime() > Date.now()) {
      throw new HttpError(429, `PIN을 여러 번 틀렸어요. ${LOCK_MINUTES}분 후 다시 시도해 주세요.`);
    }
    if (!(await verifyPin(pin, existing.pin_hash))) {
      const attempts = existing.failed_pin_attempts + 1;
      const locked = attempts >= MAX_PIN_ATTEMPTS;
      await db()
        .from("participants")
        .update({
          failed_pin_attempts: locked ? 0 : attempts,
          locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
        })
        .eq("id", existing.id);
      throw unauthorized(
        locked
          ? `PIN을 ${MAX_PIN_ATTEMPTS}번 틀려 ${LOCK_MINUTES}분간 잠겼어요.`
          : `이미 등록된 이름이에요. PIN이 맞지 않아요. (${attempts}/${MAX_PIN_ATTEMPTS})`,
      );
    }
    if (existing.failed_pin_attempts > 0) {
      await db().from("participants").update({ failed_pin_attempts: 0, locked_until: null }).eq("id", existing.id);
    }
    return { participantId: existing.id };
  }

  if (session.status !== "READY") {
    throw new HttpError(403, "게임이 이미 시작되어 새로 참가할 수 없어요. 등록한 이름과 PIN을 확인해 주세요.");
  }
  const { data, error } = await db()
    .from("participants")
    .insert({ session_id: session.id, name, pin_hash: await hashPin(pin) })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (error.code === "23505") throw conflict("같은 이름이 방금 등록되었어요. 다시 시도해 주세요.");
    throw new Error(`[db] insert participant: ${error.message}`);
  }
  await bump(session.id);
  return { participantId: data.id };
}

// ---------------------------------------------------------------- 사전 준비
export async function saveKeywords(participantId: string, keywords: string[]): Promise<void> {
  const { session, me } = await loadMe(participantId);
  if (session.status !== "READY") throw conflict("게임이 시작된 후에는 키워드를 바꿀 수 없어요.");
  const rows = KEYWORD_SLOTS.map(({ slot }, i) => {
    const value = (keywords[i] ?? "").trim();
    if (value.length < 1 || value.length > 30) throw badRequest("키워드는 1~30자로 3개 모두 입력해 주세요.");
    return { participant_id: me.id, slot_index: slot, keyword_value: value, initial_consonants: getInitialConsonants(value) };
  });
  must(await db().from("user_keywords").upsert(rows, { onConflict: "participant_id,slot_index" }), "save keywords");
  await bump(session.id);
}

export async function setLieTurn(participantId: string, lieTurn: number): Promise<void> {
  const { session, me } = await loadMe(participantId);
  if (session.tl_status !== "IDLE") throw conflict("거짓·진실 게임이 시작되어 순번을 바꿀 수 없어요.");
  must(
    await db()
      .from("truth_lie_settings")
      .upsert(
        { session_id: session.id, participant_id: me.id, lie_turn: lieTurn, updated_at: new Date().toISOString() },
        { onConflict: "session_id,participant_id" },
      ),
    "save lie turn",
  );
  await bump(session.id);
}

// ---------------------------------------------------------------- 미션
export async function submitMission(participantId: string, slot: number, note: string): Promise<void> {
  const { session, me } = await loadMe(participantId);
  await requireChain(session, me);
  if (session.status !== "ACTIVE") throw conflict("지금은 미션을 제출할 수 없어요.");
  const mission = (await listMissions(session.id)).find((m) => m.hour_slot === slot);
  if (!mission || !isMissionActive(mission)) throw conflict("진행 중인 미션이 아니에요.");

  const prev = must(
    await db()
      .from("mission_submissions")
      .select("status")
      .eq("mission_id", mission.id)
      .eq("participant_id", me.id)
      .maybeSingle<{ status: string }>(),
    "load submission",
  );
  if (prev?.status === "APPROVED") throw conflict("이미 승인된 미션이에요.");
  must(
    await db().from("mission_submissions").upsert(
      {
        mission_id: mission.id,
        participant_id: me.id,
        note,
        status: "PENDING",
        created_at: new Date().toISOString(),
        reviewed_at: null,
      },
      { onConflict: "mission_id,participant_id" },
    ),
    "submit mission",
  );
  await bump(session.id);
}

// ---------------------------------------------------------------- 조커 찬스
export async function jokerStart(participantId: string): Promise<JokerQuizView> {
  const { session, me } = await loadMe(participantId);
  const chain = await requireChain(session, me);
  if (chain.hint_used) {
    if (chain.hint_quiz && chain.hint_solved === null) {
      return { question: chain.hint_quiz.question, options: chain.hint_quiz.options };
    }
    throw conflict("조커 찬스는 한 번만 사용할 수 있어요.");
  }

  const participants = await listParticipants(session.id);
  const keywords = await listKeywords(participants.map((p) => p.id));
  const targetKeywords = keywords.filter((k) => k.participant_id === chain.receiver_id);
  const locked = targetKeywords.filter((k) => k.slot_index > chain.unlocked_level);
  if (locked.length === 0) throw conflict("힌트를 받을 수 있는 잠긴 키워드가 없어요.");

  const pick = locked[Math.floor(Math.random() * locked.length)];
  const sameSlot = keywords.filter((k) => k.participant_id !== chain.receiver_id && k.slot_index === pick.slot_index);
  const others = keywords.filter((k) => k.participant_id !== chain.receiver_id && k.slot_index !== pick.slot_index);
  // 같은 카테고리 오답을 우선 사용, 부족하면 다른 카테고리 → 기본 오답 순
  const pool = [...shuffled(sameSlot), ...shuffled(others)].map((k) => k.keyword_value);
  const { options, answerIndex } = buildQuizOptions(pick.keyword_value, pool.slice(0, Math.max(3, sameSlot.length)));

  const alias = participants.find((p) => p.id === chain.receiver_id)?.alias ?? "타깃";
  const label = KEYWORD_SLOTS.find((s) => s.slot === pick.slot_index)?.label ?? "키워드";
  const quiz: HintQuiz = { question: `'${alias}'님의 「${label}」 키워드는 무엇일까요?`, options, answerIndex };

  const claimed = must(
    await db()
      .from("manito_chains")
      .update({ hint_used: true, hint_slot: pick.slot_index, hint_quiz: quiz, hint_solved: null })
      .eq("id", chain.id)
      .eq("hint_used", false)
      .select("hint_quiz")
      .maybeSingle<{ hint_quiz: HintQuiz }>(),
    "claim joker",
  );
  if (!claimed) return jokerStart(participantId); // 동시 요청: 먼저 저장된 퀴즈 반환
  await bump(session.id);
  return { question: quiz.question, options: quiz.options };
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function jokerAnswer(
  participantId: string,
  optionIndex: number,
): Promise<{ correct: boolean; hint: string | null }> {
  const { session, me } = await loadMe(participantId);
  const chain = await requireChain(session, me);
  if (!chain.hint_used || !chain.hint_quiz) throw conflict("먼저 조커 찬스를 사용해 주세요.");
  if (chain.hint_solved !== null) throw conflict("이미 답을 제출했어요.");

  const correct = optionIndex === chain.hint_quiz.answerIndex;
  const saved = must(
    await db()
      .from("manito_chains")
      .update({ hint_solved: correct })
      .eq("id", chain.id)
      .is("hint_solved", null)
      .select("id")
      .maybeSingle(),
    "answer joker",
  );
  if (!saved) throw conflict("이미 답을 제출했어요.");
  await bump(session.id);

  if (!correct) return { correct, hint: null };
  const answer = chain.hint_quiz.options[chain.hint_quiz.answerIndex];
  return { correct, hint: getHint(answer) };
}

// ---------------------------------------------------------------- 배팅 / 추리
export async function placeBet(participantId: string, faction: Faction, prediction: Prediction): Promise<void> {
  const { session, me } = await loadMe(participantId);
  await requireChain(session, me);
  if (session.bet_status !== "OPEN") throw conflict("배팅이 마감되었어요.");
  must(
    await db()
      .from("faction_bets")
      .upsert(
        { session_id: session.id, participant_id: me.id, faction, prediction, updated_at: new Date().toISOString() },
        { onConflict: "session_id,participant_id" },
      ),
    "place bet",
  );
  await bump(session.id);
}

export async function makeGuess(participantId: string, guessId: string): Promise<void> {
  const { session, me } = await loadMe(participantId);
  const chain = await requireChain(session, me);
  if (session.status !== "GUESSING") throw conflict("지금은 최종 추리 시간이 아니에요.");
  if (guessId === me.id) throw badRequest("자기 자신은 고를 수 없어요.");
  const exists = (await listParticipants(session.id)).some((p) => p.id === guessId);
  if (!exists) throw badRequest("존재하지 않는 참가자예요.");
  must(
    await db()
      .from("manito_chains")
      .update({ final_guess_id: guessId, is_guess_correct: guessId === chain.receiver_id })
      .eq("id", chain.id),
    "save guess",
  );
  await bump(session.id);
}
