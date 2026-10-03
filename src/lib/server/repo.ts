import "server-only";
import { randomInt } from "node:crypto";
import {
  DEFAULT_MISSIONS,
  TRUTH_LIE_REVEAL_DELAY_MIN,
  MAX_HINT_LEVEL,
  MISSION_DURATION_MIN,
  MISSION_FIRST_DELAY_MIN,
  MISSION_INTERVAL_MIN,
  MISSION_SLOT_COUNT,
  UNLOCK_THRESHOLDS,
} from "@/lib/config";
import type { BetStatus, Faction, Prediction, SessionStatus, SubmissionStatus, TimerStatus, TimerView } from "@/lib/types";
import { db, must, mustOne } from "./supabase";

// ---------------------------------------------------------------- Row 타입 (DB 컬럼 그대로)
export interface SessionRow {
  id: string;
  code: string;
  status: SessionStatus;
  revision: number;
  tl_status: TimerStatus;
  tl_duration_sec: number;
  tl_ends_at: string | null;
  tl_remaining_sec: number | null;
  tl_revealed: boolean;
  tl_reveal_at: string | null;
  bet_status: BetStatus;
  winning_faction: Faction | null;
  started_at: string | null;
  mission_auto: boolean;
  next_mission_at: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  pin_hash: string;
  alias: string | null;
  is_bot: boolean;
  is_ready: boolean;
  failed_pin_attempts: number;
  next_quiz_at: string | null;
  locked_until: string | null;
  created_at: string;
}

export interface KeywordRow {
  participant_id: string;
  slot_index: number;
  keyword_value: string;
  initial_consonants: string;
}

export interface HintQuiz {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface ChainRow {
  id: string;
  session_id: string;
  position: number;
  giver_id: string;
  receiver_id: string;
  unlocked_level: number;
  unlock_bonus: number;
  hint_used: boolean;
  hint_slot: number | null;
  hint_quiz: HintQuiz | null;
  hint_solved: boolean | null;
  hidden_quest: string | null;
  final_guess_id: string | null;
  is_guess_correct: boolean | null;
}

export interface MissionRow {
  id: string;
  session_id: string;
  hour_slot: number;
  title: string;
  description: string;
  opened_at: string | null;
  deadline_time: string | null;
}

export interface SubmissionRow {
  id: string;
  mission_id: string;
  participant_id: string;
  note: string;
  status: SubmissionStatus;
  photo_path: string | null;
  created_at: string;
}

export interface TruthLieRow {
  participant_id: string;
  lie_turn: number;
}

export interface BetRow {
  participant_id: string;
  faction: Faction;
  prediction: Prediction;
}

// ---------------------------------------------------------------- 세션
/**
 * 메인 세션 로드. 거짓·진실 타이머가 만료됐으면 여기서 ENDED + 자동 공개로 확정한다 (lazy 판정, A6).
 */
export async function getSession(): Promise<SessionRow> {
  let session: SessionRow | null = must(
    await db().from("game_sessions").select("*").eq("code", "main").maybeSingle<SessionRow>(),
    "load session",
  );
  if (!session) {
    session = mustOne(
      await db().from("game_sessions").upsert({ code: "main" }, { onConflict: "code" }).select("*").single<SessionRow>(),
      "create session",
    );
  }

  if (session.tl_status === "RUNNING" && session.tl_ends_at && new Date(session.tl_ends_at).getTime() <= Date.now()) {
    const updated = must(
      await db()
        .from("game_sessions")
        .update({ tl_status: "ENDED", tl_remaining_sec: 0, tl_revealed: false, tl_reveal_at: revealAtFromNow() })
        .eq("id", session.id)
        .eq("tl_status", "RUNNING")
        .eq("tl_ends_at", session.tl_ends_at)
        .select("*")
        .maybeSingle<SessionRow>(),
      "expire timer",
    );
    if (updated) {
      await bump(session.id);
      session = { ...updated, revision: updated.revision + 1 };
    }
  }
  session = await autoReveal(session);
  return autoOpenMission(session);
}

export const revealAtFromNow = () => new Date(Date.now() + TRUTH_LIE_REVEAL_DELAY_MIN * 60_000).toISOString();

/** 타이머 종료 후 예약된 공개 시각이 지나면 순번을 자동 공개 (lazy, 조건부 update 로 한 번만) */
async function autoReveal(session: SessionRow): Promise<SessionRow> {
  if (session.tl_status !== "ENDED" || session.tl_revealed || !session.tl_reveal_at) return session;
  if (Date.parse(session.tl_reveal_at) > Date.now()) return session;
  const updated = must(
    await db()
      .from("game_sessions")
      .update({ tl_revealed: true })
      .eq("id", session.id)
      .eq("tl_revealed", false)
      .select("*")
      .maybeSingle<SessionRow>(),
    "auto reveal",
  );
  if (!updated) return session;
  await bump(session.id);
  return { ...updated, revision: updated.revision + 1 };
}

const minutesFromNow = ([lo, hi]: [number, number]) =>
  new Date(Date.now() + randomInt(lo * 60, hi * 60 + 1) * 1000).toISOString();
export const firstMissionAt = () => minutesFromNow(MISSION_FIRST_DELAY_MIN);
export const nextMissionAt = () => minutesFromNow(MISSION_INTERVAL_MIN);

/** 아직 안 열린 가장 앞 슬롯을 지금부터 MISSION_DURATION_MIN 동안 오픈. 남은 미오픈 슬롯 수 반환 */
export async function openNextUnopenedMission(sessionId: string): Promise<{ opened: number | null; remaining: number }> {
  const missions = await listMissions(sessionId);
  const unopened = missions.filter((m) => !m.opened_at);
  const target = unopened[0];
  if (!target) return { opened: null, remaining: 0 };
  const now = Date.now();
  const updated = must(
    await db()
      .from("hourly_missions")
      .update({
        opened_at: new Date(now).toISOString(),
        deadline_time: new Date(now + MISSION_DURATION_MIN * 60_000).toISOString(),
      })
      .eq("id", target.id)
      .is("opened_at", null)
      .select("hour_slot")
      .maybeSingle<{ hour_slot: number }>(),
    "auto open mission",
  );
  return { opened: updated?.hour_slot ?? null, remaining: unopened.length - (updated ? 1 : 0) };
}

/**
 * 미션 랜덤 자동 오픈 (lazy 스케줄러, 요청 시 판정).
 * next_mission_at 을 조건부 update 로 선점 → 동시 요청에도 한 번만 오픈.
 */
async function autoOpenMission(session: SessionRow): Promise<SessionRow> {
  if (session.status !== "ACTIVE" || !session.mission_auto || !session.next_mission_at) return session;
  if (Date.parse(session.next_mission_at) > Date.now()) return session;

  const claimed = must(
    await db()
      .from("game_sessions")
      .update({ next_mission_at: nextMissionAt() })
      .eq("id", session.id)
      .eq("next_mission_at", session.next_mission_at)
      .select("*")
      .maybeSingle<SessionRow>(),
    "claim auto mission",
  );
  if (!claimed) return session; // 다른 요청이 이미 처리

  const { remaining } = await openNextUnopenedMission(session.id);
  let result = claimed;
  if (remaining === 0) {
    result = must(
      await db().from("game_sessions").update({ next_mission_at: null }).eq("id", session.id).select("*").single<SessionRow>(),
      "finish auto missions",
    ) as SessionRow;
  }
  await bump(session.id);
  return { ...result, revision: result.revision + 1 };
}

/** 변경 신호 발생 → 모든 클라이언트 Realtime 재조회 */
export async function bump(sessionId: string): Promise<void> {
  must(await db().rpc("bump_revision", { p_session: sessionId }), "bump revision");
}

export function timerView(s: SessionRow): TimerView {
  let remainingSec: number;
  if (s.tl_status === "RUNNING" && s.tl_ends_at) {
    remainingSec = Math.max(0, Math.ceil((new Date(s.tl_ends_at).getTime() - Date.now()) / 1000));
  } else if (s.tl_status === "ENDED") {
    remainingSec = 0;
  } else {
    remainingSec = s.tl_remaining_sec ?? s.tl_duration_sec;
  }
  return {
    status: s.tl_status,
    durationSec: s.tl_duration_sec,
    endsAt: s.tl_status === "RUNNING" ? s.tl_ends_at : null,
    remainingSec,
    revealed: s.tl_revealed,
    revealAt: s.tl_status === "ENDED" && !s.tl_revealed ? s.tl_reveal_at : null,
  };
}

// ---------------------------------------------------------------- 조회 헬퍼
export async function listParticipants(sessionId: string): Promise<ParticipantRow[]> {
  return must(
    await db().from("participants").select("*").eq("session_id", sessionId).order("created_at"),
    "list participants",
  ) as ParticipantRow[];
}

export async function listKeywords(participantIds: string[]): Promise<KeywordRow[]> {
  if (participantIds.length === 0) return [];
  return must(
    await db()
      .from("user_keywords")
      .select("participant_id, slot_index, keyword_value, initial_consonants")
      .in("participant_id", participantIds)
      .order("slot_index"),
    "list keywords",
  ) as KeywordRow[];
}

export async function listChains(sessionId: string): Promise<ChainRow[]> {
  return must(
    await db().from("manito_chains").select("*").eq("session_id", sessionId).order("position"),
    "list chains",
  ) as ChainRow[];
}

export async function getChainByGiver(sessionId: string, giverId: string): Promise<ChainRow | null> {
  return must(
    await db()
      .from("manito_chains")
      .select("*")
      .eq("session_id", sessionId)
      .eq("giver_id", giverId)
      .maybeSingle<ChainRow>(),
    "load chain",
  );
}

/** 8개 미션 슬롯이 항상 존재하도록 보장 (없으면 기본 미션으로 생성) */
export async function listMissions(sessionId: string): Promise<MissionRow[]> {
  let rows = must(
    await db().from("hourly_missions").select("*").eq("session_id", sessionId).order("hour_slot"),
    "list missions",
  ) as MissionRow[];
  if (rows.length < MISSION_SLOT_COUNT) {
    const existing = new Set(rows.map((r) => r.hour_slot));
    const missing = DEFAULT_MISSIONS.map((m, i) => ({ session_id: sessionId, hour_slot: i + 1, ...m })).filter(
      (m) => !existing.has(m.hour_slot),
    );
    must(
      await db().from("hourly_missions").upsert(missing, { onConflict: "session_id,hour_slot", ignoreDuplicates: true }),
      "seed missions",
    );
    rows = must(
      await db().from("hourly_missions").select("*").eq("session_id", sessionId).order("hour_slot"),
      "list missions",
    ) as MissionRow[];
  }
  return rows;
}

export async function listSubmissions(missionIds: string[]): Promise<SubmissionRow[]> {
  if (missionIds.length === 0) return [];
  return must(
    await db()
      .from("mission_submissions")
      .select("id, mission_id, participant_id, note, status, photo_path, created_at")
      .in("mission_id", missionIds)
      .order("created_at", { ascending: false }),
    "list submissions",
  ) as SubmissionRow[];
}

export async function listTruthLie(sessionId: string): Promise<TruthLieRow[]> {
  return must(
    await db().from("truth_lie_settings").select("participant_id, lie_turn").eq("session_id", sessionId),
    "list truth-lie",
  ) as TruthLieRow[];
}

export async function listBets(sessionId: string): Promise<BetRow[]> {
  return must(
    await db().from("faction_bets").select("participant_id, faction, prediction").eq("session_id", sessionId),
    "list bets",
  ) as BetRow[];
}

// ---------------------------------------------------------------- 규칙
export function thresholdLevel(points: number): number {
  return UNLOCK_THRESHOLDS.filter((t) => points >= t).length;
}

export function clampLevel(level: number): number {
  return Math.min(MAX_HINT_LEVEL, Math.max(0, level));
}

export function nextUnlockAt(level: number): number | null {
  return level >= MAX_HINT_LEVEL ? null : (UNLOCK_THRESHOLDS[level] ?? null);
}

export function betCorrect(bet: BetRow | undefined, winning: Faction | null): boolean | null {
  if (!bet || !winning) return null;
  return (bet.faction === winning) === (bet.prediction === "WIN");
}

export async function getChainByReceiver(sessionId: string, receiverId: string): Promise<ChainRow | null> {
  return must(
    await db()
      .from("manito_chains")
      .select("*")
      .eq("session_id", sessionId)
      .eq("receiver_id", receiverId)
      .maybeSingle<ChainRow>(),
    "load chain by receiver",
  );
}

export async function countApproved(sessionId: string, participantId: string): Promise<number> {
  const missions = await listMissions(sessionId);
  const { count, error } = await db()
    .from("mission_submissions")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .eq("status", "APPROVED")
    .in(
      "mission_id",
      missions.map((m) => m.id),
    );
  if (error) throw new Error(`[db] count approved: ${error.message}`);
  return count ?? 0;
}

export async function countQuizCorrect(sessionId: string, participantId: string): Promise<number> {
  const { count, error } = await db()
    .from("tmi_quizzes")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("participant_id", participantId)
    .eq("is_correct", true);
  if (error) throw new Error(`[db] count quiz: ${error.message}`);
  return count ?? 0;
}

/** 힌트 포인트 = 내 승인 미션 수 + 내 퀴즈 정답 수 */
export async function hintPoints(sessionId: string, participantId: string) {
  const [missions, quizzes] = await Promise.all([
    countApproved(sessionId, participantId),
    countQuizCorrect(sessionId, participantId),
  ]);
  return { missions, quizzes, total: missions + quizzes };
}

/**
 * 참가자 P 의 포인트 재계산 → P 가 "자신의 비밀 마니또"에 대해 해금한 단계 동기화.
 * 대상 행은 giver→P (receiver = P) 체인. unlock_bonus(관리자 보정) 반영.
 */
export async function recomputeUnlock(sessionId: string, participantId: string): Promise<void> {
  const chain = await getChainByReceiver(sessionId, participantId);
  if (!chain) return;
  const { total } = await hintPoints(sessionId, participantId);
  const level = clampLevel(thresholdLevel(total) + chain.unlock_bonus);
  if (level !== chain.unlocked_level) {
    must(await db().from("manito_chains").update({ unlocked_level: level }).eq("id", chain.id), "update level");
  }
}

export function isMissionActive(m: MissionRow, now = Date.now()): boolean {
  return !!m.opened_at && !!m.deadline_time && new Date(m.deadline_time).getTime() > now;
}
