import "server-only";
import { AWAY_RETURN_BUFFER_MIN } from "@/lib/config";
import { type AwayPeriod, personalDeadline } from "@/lib/game/away";
import { conflict } from "./http";
import { firstQuizAt } from "./quiz";
import { bump, getSession, type MissionRow } from "./repo";
import { db, must } from "./supabase";

interface AwayRow {
  participant_id: string;
  started_at: string;
  ended_at: string | null;
}

/** 참가자별 자리비움 기록 */
export async function listAwayPeriods(sessionId: string, participantId?: string): Promise<Map<string, AwayPeriod[]>> {
  let q = db().from("away_periods").select("participant_id, started_at, ended_at").eq("session_id", sessionId);
  if (participantId) q = q.eq("participant_id", participantId);
  const rows = must(await q, "list away") as AwayRow[];
  const map = new Map<string, AwayPeriod[]>();
  for (const r of rows) {
    const list = map.get(r.participant_id) ?? [];
    list.push({ startedAt: Date.parse(r.started_at), endedAt: r.ended_at ? Date.parse(r.ended_at) : null });
    map.set(r.participant_id, list);
  }
  return map;
}

export function awaySince(periods: AwayPeriod[] | undefined): string | null {
  const open = periods?.find((p) => p.endedAt === null);
  return open ? new Date(open.startedAt).toISOString() : null;
}

/** 자리비움 유예 반영 개인 마감 (미오픈 미션은 null) */
export function missionDeadlineFor(m: MissionRow, periods: AwayPeriod[] | undefined, now = Date.now()) {
  if (!m.opened_at || !m.deadline_time) return { deadline: null as string | null, graceSec: 0 };
  const r = personalDeadline(Date.parse(m.opened_at), Date.parse(m.deadline_time), periods ?? [], now, AWAY_RETURN_BUFFER_MIN * 60_000);
  return { deadline: new Date(r.deadline).toISOString(), graceSec: Math.round(r.graceMs / 1000) };
}

export function isMissionActiveFor(m: MissionRow, periods: AwayPeriod[] | undefined, now = Date.now()): boolean {
  const { deadline } = missionDeadlineFor(m, periods, now);
  return !!deadline && Date.parse(deadline) > now;
}

/** 자리비움 설정/복귀 (본인 또는 관리자) */
export async function setAway(participantId: string, away: boolean, setBy: "SELF" | "ADMIN"): Promise<void> {
  const session = await getSession();
  if (session.status !== "ACTIVE" && session.status !== "GUESSING") {
    throw conflict("자리비움은 게임 진행 중에만 설정할 수 있어요.");
  }
  const exists = must(
    await db().from("participants").select("id").eq("id", participantId).eq("session_id", session.id).maybeSingle(),
    "load participant",
  );
  if (!exists) throw conflict("참가자를 찾을 수 없어요.");

  if (away) {
    const { error } = await db()
      .from("away_periods")
      .insert({ session_id: session.id, participant_id: participantId, set_by: setBy });
    if (error?.code === "23505") return; // 이미 자리비움 중
    if (error) throw new Error(`[db] set away: ${error.message}`);
    // 대기 중 퀴즈는 오답 처리하지 않고 취소
    must(
      await db().from("tmi_quizzes").delete().eq("participant_id", participantId).is("answered_at", null),
      "cancel pending quiz",
    );
  } else {
    must(
      await db()
        .from("away_periods")
        .update({ ended_at: new Date().toISOString() })
        .eq("participant_id", participantId)
        .is("ended_at", null),
      "end away",
    );
    // 복귀 직후 바로 퀴즈가 쏟아지지 않도록 다음 퀴즈 재예약
    must(await db().from("participants").update({ next_quiz_at: firstQuizAt() }).eq("id", participantId), "reschedule quiz");
  }
  await bump(session.id);
}
