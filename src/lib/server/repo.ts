import "server-only";
import { DEFAULT_MISSIONS, MISSION_SLOT_COUNT, UNLOCK_THRESHOLDS } from "@/lib/config";
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
  bet_status: BetStatus;
  winning_faction: Faction | null;
  started_at: string | null;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  pin_hash: string;
  alias: string | null;
  failed_pin_attempts: number;
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
        .update({ tl_status: "ENDED", tl_remaining_sec: 0, tl_revealed: true })
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
  return session;
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
      .select("id, mission_id, participant_id, note, status, created_at")
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
export function thresholdLevel(approvedCount: number): number {
  return UNLOCK_THRESHOLDS.filter((t) => approvedCount >= t).length;
}

export function clampLevel(level: number): number {
  return Math.min(3, Math.max(0, level));
}

export function nextUnlockAt(level: number): number | null {
  return level >= 3 ? null : (UNLOCK_THRESHOLDS[level] ?? null);
}

export function betCorrect(bet: BetRow | undefined, winning: Faction | null): boolean | null {
  if (!bet || !winning) return null;
  return (bet.faction === winning) === (bet.prediction === "WIN");
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

/** 승인 미션 수 재계산 → 해금 레벨 동기화 (unlock_bonus 반영) */
export async function recomputeUnlock(sessionId: string, giverId: string): Promise<void> {
  const chain = await getChainByGiver(sessionId, giverId);
  if (!chain) return;
  const level = clampLevel(thresholdLevel(await countApproved(sessionId, giverId)) + chain.unlock_bonus);
  if (level !== chain.unlocked_level) {
    must(await db().from("manito_chains").update({ unlocked_level: level }).eq("id", chain.id), "update level");
  }
}

export function isMissionActive(m: MissionRow, now = Date.now()): boolean {
  return !!m.opened_at && !!m.deadline_time && new Date(m.deadline_time).getTime() > now;
}
