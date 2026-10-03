import "server-only";
import { randomInt } from "node:crypto";
import { QUIZ_ANSWER_SEC, QUIZ_FIRST_DELAY_MIN, QUIZ_INTERVAL_MIN } from "@/lib/config";
import { buildTmiQuiz } from "@/lib/game/tmi";
import type { QuizAnswerResult, QuizView } from "@/lib/types";
import { conflict } from "./http";
import { bump, getSession, listParticipants, type ParticipantRow, recomputeUnlock, type SessionRow } from "./repo";
import { db, must } from "./supabase";
import { listFacts } from "./tmi";

interface QuizRow {
  id: string;
  participant_id: string;
  fact_id: string | null;
  question: string;
  options: string[];
  answer_index: number;
  expires_at: string;
  answered_at: string | null;
  is_correct: boolean | null;
}

const minutesFromNow = ([lo, hi]: [number, number]) =>
  new Date(Date.now() + randomInt(lo * 60, hi * 60 + 1) * 1000).toISOString();

export const firstQuizAt = () => minutesFromNow(QUIZ_FIRST_DELAY_MIN);
const nextQuizAt = () => minutesFromNow(QUIZ_INTERVAL_MIN);

async function setNext(participantId: string, at: string) {
  must(await db().from("participants").update({ next_quiz_at: at }).eq("id", participantId), "schedule quiz");
}

async function listMyQuizzes(sessionId: string, participantId: string): Promise<QuizRow[]> {
  return must(
    await db()
      .from("tmi_quizzes")
      .select("id, participant_id, fact_id, question, options, answer_index, expires_at, answered_at, is_correct")
      .eq("session_id", sessionId)
      .eq("participant_id", participantId)
      .order("created_at"),
    "list quizzes",
  ) as QuizRow[];
}

/**
 * 수시 퀴즈 lazy 스케줄러 (상태 조회 시 호출).
 * - 만료된 미응답 퀴즈 → 오답 처리 후 다음 퀴즈 예약
 * - 예약 시각이 지났으면 새 퀴즈 생성 (참가자당 미응답 1개: DB 부분 unique 인덱스로 보장)
 */
export async function ensureQuiz(session: SessionRow, me: ParticipantRow, participantNames: string[]): Promise<QuizView> {
  let rows = await listMyQuizzes(session.id, me.id);
  const now = Date.now();
  let pending = rows.find((q) => !q.answered_at) ?? null;

  if (pending && new Date(pending.expires_at).getTime() < now) {
    await db()
      .from("tmi_quizzes")
      .update({ answered_at: new Date().toISOString(), is_correct: false })
      .eq("id", pending.id)
      .is("answered_at", null);
    pending = null;
    await setNext(me.id, nextQuizAt());
    rows = await listMyQuizzes(session.id, me.id);
  } else if (session.status === "ACTIVE" && !pending) {
    if (!me.next_quiz_at) {
      await setNext(me.id, firstQuizAt());
    } else if (new Date(me.next_quiz_at).getTime() <= now) {
      const facts = await listFacts(session.id);
      const used = new Set(rows.map((r) => r.fact_id).filter((x): x is string => !!x));
      const quiz = buildTmiQuiz(facts, me.name, participantNames, used);
      await setNext(me.id, nextQuizAt());
      if (quiz) {
        const { error } = await db().from("tmi_quizzes").insert({
          session_id: session.id,
          participant_id: me.id,
          fact_id: quiz.factId,
          question: quiz.question,
          options: quiz.options,
          answer_index: quiz.answerIndex,
          expires_at: new Date(now + QUIZ_ANSWER_SEC * 1000).toISOString(),
        });
        if (error && error.code !== "23505") throw new Error(`[db] create quiz: ${error.message}`);
        rows = await listMyQuizzes(session.id, me.id);
        pending = rows.find((q) => !q.answered_at) ?? null;
      }
    }
  }

  const answered = rows.filter((r) => r.answered_at);
  return {
    pending:
      pending && session.status === "ACTIVE"
        ? { id: pending.id, question: pending.question, options: pending.options, expiresAt: pending.expires_at }
        : null,
    score: answered.filter((r) => r.is_correct).length,
    answered: answered.length,
  };
}

export async function answerQuiz(participantId: string, quizId: string, optionIndex: number): Promise<QuizAnswerResult> {
  const session = await getSession();
  const quiz = must(
    await db()
      .from("tmi_quizzes")
      .select("id, participant_id, fact_id, question, options, answer_index, expires_at, answered_at, is_correct")
      .eq("id", quizId)
      .eq("participant_id", participantId)
      .maybeSingle<QuizRow>(),
    "load quiz",
  );
  if (!quiz) throw conflict("퀴즈를 찾을 수 없어요.");
  if (quiz.answered_at) throw conflict("이미 답한 퀴즈예요.");
  // 네트워크 지연 감안 5초 유예
  if (new Date(quiz.expires_at).getTime() + 5000 < Date.now()) throw conflict("시간이 초과됐어요.");

  const correct = optionIndex === quiz.answer_index;
  const saved = must(
    await db()
      .from("tmi_quizzes")
      .update({ answered_at: new Date().toISOString(), chosen_index: optionIndex, is_correct: correct })
      .eq("id", quiz.id)
      .is("answered_at", null)
      .select("id")
      .maybeSingle(),
    "answer quiz",
  );
  if (!saved) throw conflict("이미 답한 퀴즈예요.");
  await setNext(participantId, nextQuizAt());
  if (correct) await recomputeUnlock(session.id, participantId);
  await bump(session.id);

  const { count } = await db()
    .from("tmi_quizzes")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .eq("is_correct", true);
  return { correct, correctAnswer: quiz.options[quiz.answer_index], score: count ?? 0 };
}

/** 관리자: 미응답 퀴즈가 없는 전원에게 즉시 퀴즈 (각자 다음 조회 때 생성) */
export async function sendQuizNow(): Promise<void> {
  const session = await getSession();
  if (session.status !== "ACTIVE") throw conflict("게임 진행 중에만 퀴즈를 보낼 수 있어요.");
  must(
    await db().from("participants").update({ next_quiz_at: new Date().toISOString() }).eq("session_id", session.id),
    "send quiz now",
  );
  await bump(session.id);
}

export async function quizStats(sessionId: string) {
  const rows = must(
    await db().from("tmi_quizzes").select("participant_id, answered_at, is_correct").eq("session_id", sessionId),
    "quiz stats",
  ) as { participant_id: string; answered_at: string | null; is_correct: boolean | null }[];
  const scoreBy = new Map<string, number>();
  for (const r of rows) if (r.is_correct) scoreBy.set(r.participant_id, (scoreBy.get(r.participant_id) ?? 0) + 1);
  return {
    pendingCount: rows.filter((r) => !r.answered_at).length,
    answeredCount: rows.filter((r) => r.answered_at).length,
    correctCount: rows.filter((r) => r.is_correct).length,
    scoreBy,
  };
}

/** 봇 테스트용: 봇의 퀴즈를 생성·응답 */
export async function botAnswerQuizzes(session: SessionRow, bots: ParticipantRow[]): Promise<number> {
  const names = (await listParticipants(session.id)).map((p) => p.name);
  let n = 0;
  for (const bot of bots) {
    await setNext(bot.id, new Date().toISOString());
    const view = await ensureQuiz(session, { ...bot, next_quiz_at: new Date().toISOString() }, names);
    if (view.pending) {
      await answerQuiz(bot.id, view.pending.id, randomInt(view.pending.options.length));
      n++;
    }
  }
  return n;
}
