import "server-only";
import { HIDDEN_QUESTS, MIN_PARTICIPANTS } from "@/lib/config";
import { generateAliases } from "@/lib/game/alias";
import { buildSingleCycle } from "@/lib/game/cycle";
import type { Faction, SubmissionStatus } from "@/lib/types";
import { badRequest, conflict } from "./http";
import { firstQuizAt } from "./quiz";
import {
  bump,
  clampLevel,
  hintPoints,
  getSession,
  listChains,
  listKeywords,
  listMissions,
  listParticipants,
  recomputeUnlock,
  type SessionRow,
  thresholdLevel,
} from "./repo";
import { db, must } from "./supabase";

const nowIso = () => new Date().toISOString();

async function updateSession(session: SessionRow, patch: Partial<SessionRow>) {
  must(await db().from("game_sessions").update(patch).eq("id", session.id), "update session");
  await bump(session.id);
}

// ---------------------------------------------------------------- 세션 단계
/** 참가자 ≥ 4 확인 → 단일 순환 셔플 → ACTIVE */
export async function startGame(force: boolean): Promise<void> {
  const session = await getSession();
  if (session.status !== "READY") throw conflict("이미 게임이 시작되었어요.");
  const participants = await listParticipants(session.id);
  if (participants.length < MIN_PARTICIPANTS) {
    throw conflict(`최소 ${MIN_PARTICIPANTS}명 이상이어야 시작할 수 있어요. (현재 ${participants.length}명)`);
  }
  if (!force) {
    const keywords = await listKeywords(participants.map((p) => p.id));
    const count = new Map<string, number>();
    for (const k of keywords) count.set(k.participant_id, (count.get(k.participant_id) ?? 0) + 1);
    const missing = participants.filter((p) => (count.get(p.id) ?? 0) < 3).map((p) => p.name);
    if (missing.length) {
      throw conflict(`키워드를 다 입력하지 않은 참가자가 있어요: ${missing.join(", ")}`, { missing });
    }
  }

  // 원자적 선점: READY → ACTIVE (중복 클릭/동시 요청 방지)
  const claimed = must(
    await db()
      .from("game_sessions")
      .update({ status: "ACTIVE", started_at: nowIso() })
      .eq("id", session.id)
      .eq("status", "READY")
      .select("id")
      .maybeSingle(),
    "claim start",
  );
  if (!claimed) throw conflict("이미 게임이 시작되었어요.");

  try {
    const links = buildSingleCycle(participants.map((p) => p.id));
    const aliases = generateAliases(participants.length);
    await Promise.all(
      participants.map((p, i) =>
        db()
          .from("participants")
          .update({ alias: aliases[i], next_quiz_at: firstQuizAt() })
          .eq("id", p.id)
          .then((r) => must(r, "set alias")),
      ),
    );
    must(await db().from("manito_chains").delete().eq("session_id", session.id), "clear chains");
    must(
      await db()
        .from("manito_chains")
        .insert(
          links.map((l) => ({
            session_id: session.id,
            position: l.position,
            giver_id: l.giver,
            receiver_id: l.receiver,
            hidden_quest: HIDDEN_QUESTS[Math.floor(Math.random() * HIDDEN_QUESTS.length)],
          })),
        ),
      "insert chains",
    );
    await listMissions(session.id); // 미션 8슬롯 보장
  } catch (e) {
    await db().from("game_sessions").update({ status: "READY", started_at: null }).eq("id", session.id);
    throw e;
  }
  await bump(session.id);
}

export async function setPhase(action: "guessing" | "finish" | "back-to-active"): Promise<void> {
  const session = await getSession();
  const allowed: Record<typeof action, SessionRow["status"][]> = {
    guessing: ["ACTIVE", "FINISHED"],
    finish: ["GUESSING", "ACTIVE"],
    "back-to-active": ["GUESSING", "FINISHED"],
  };
  if (!allowed[action].includes(session.status)) throw conflict("현재 상태에서는 할 수 없는 작업이에요.");
  const status = action === "guessing" ? "GUESSING" : action === "finish" ? "FINISHED" : "ACTIVE";
  await updateSession(session, { status });
}

/** 리허설 후 초기화. keepParticipants=true 면 참가자·키워드는 유지 */
export async function resetGame(keepParticipants: boolean): Promise<void> {
  const session = await getSession();
  const sid = session.id;
  // 테스트 봇은 옵션과 무관하게 항상 삭제 (실제 파티에 섞이지 않도록)
  must(await db().from("participants").delete().eq("session_id", sid).eq("is_bot", true), "reset bots");
  if (keepParticipants) {
    must(await db().from("manito_chains").delete().eq("session_id", sid), "reset chains");
    must(await db().from("truth_lie_settings").delete().eq("session_id", sid), "reset truth-lie");
    must(await db().from("faction_bets").delete().eq("session_id", sid), "reset bets");
    must(await db().from("participants").update({ alias: null }).eq("session_id", sid), "reset aliases");
  } else {
    must(await db().from("participants").delete().eq("session_id", sid), "reset participants");
  }
  // 퀴즈·AI 질문 삭제 + 퀴즈 예약 초기화 (TMI 데이터는 유지). 우편함은 체인 삭제 시 cascade
  must(await db().from("tmi_quizzes").delete().eq("session_id", sid), "reset quizzes");
  must(await db().from("ai_questions").delete().eq("session_id", sid), "reset ai questions");
  must(await db().from("mails").delete().eq("session_id", sid), "reset mails");
  if (keepParticipants) {
    must(await db().from("participants").update({ next_quiz_at: null }).eq("session_id", sid), "reset quiz schedule");
  }
  // 미션 제출물 삭제 + 오픈 상태 초기화 (제목/설명은 유지)
  const missions = await listMissions(sid);
  if (missions.length) {
    must(
      await db()
        .from("mission_submissions")
        .delete()
        .in(
          "mission_id",
          missions.map((m) => m.id),
        ),
      "reset submissions",
    );
  }
  must(
    await db().from("hourly_missions").update({ opened_at: null, deadline_time: null }).eq("session_id", sid),
    "reset missions",
  );
  await updateSession(session, {
    status: "READY",
    started_at: null,
    tl_status: "IDLE",
    tl_ends_at: null,
    tl_remaining_sec: null,
    tl_revealed: false,
    bet_status: "OPEN",
    winning_faction: null,
  });
}

export async function removeParticipant(participantId: string): Promise<void> {
  const session = await getSession();
  if (session.status !== "READY") throw conflict("게임 시작 후에는 참가자를 삭제할 수 없어요. (매칭 고리가 끊어짐)");
  must(await db().from("participants").delete().eq("id", participantId).eq("session_id", session.id), "remove");
  await bump(session.id);
}

// ---------------------------------------------------------------- 거짓·진실 타이머
export type TimerAction = "start" | "pause" | "resume" | "end" | "reset" | "reveal" | "hide";

export async function controlTimer(action: TimerAction, durationSec?: number): Promise<void> {
  const s = await getSession();
  const now = Date.now();
  switch (action) {
    case "start": {
      const dur = durationSec ?? s.tl_duration_sec;
      return updateSession(s, {
        tl_status: "RUNNING",
        tl_duration_sec: dur,
        tl_ends_at: new Date(now + dur * 1000).toISOString(),
        tl_remaining_sec: dur,
        tl_revealed: false,
      });
    }
    case "pause": {
      if (s.tl_status !== "RUNNING" || !s.tl_ends_at) throw conflict("진행 중인 타이머가 없어요.");
      const remaining = Math.max(0, Math.ceil((new Date(s.tl_ends_at).getTime() - now) / 1000));
      return updateSession(s, { tl_status: "PAUSED", tl_ends_at: null, tl_remaining_sec: remaining });
    }
    case "resume": {
      if (s.tl_status !== "PAUSED") throw conflict("일시정지된 타이머가 없어요.");
      const remaining = s.tl_remaining_sec ?? s.tl_duration_sec;
      return updateSession(s, { tl_status: "RUNNING", tl_ends_at: new Date(now + remaining * 1000).toISOString() });
    }
    case "end":
      return updateSession(s, { tl_status: "ENDED", tl_ends_at: null, tl_remaining_sec: 0, tl_revealed: true });
    case "reset":
      return updateSession(s, {
        tl_status: "IDLE",
        tl_ends_at: null,
        tl_remaining_sec: s.tl_duration_sec,
        tl_revealed: false,
      });
    case "reveal":
      return updateSession(s, { tl_revealed: true });
    case "hide":
      return updateSession(s, { tl_revealed: false });
  }
}

// ---------------------------------------------------------------- 미션
export async function saveMission(slot: number, title: string, description: string): Promise<void> {
  const session = await getSession();
  await listMissions(session.id);
  must(
    await db()
      .from("hourly_missions")
      .update({ title, description })
      .eq("session_id", session.id)
      .eq("hour_slot", slot),
    "save mission",
  );
  await bump(session.id);
}

export async function openMission(slot: number, durationMin: number): Promise<void> {
  const session = await getSession();
  await listMissions(session.id);
  const now = Date.now();
  must(
    await db()
      .from("hourly_missions")
      .update({
        opened_at: new Date(now).toISOString(),
        deadline_time: new Date(now + durationMin * 60_000).toISOString(),
      })
      .eq("session_id", session.id)
      .eq("hour_slot", slot),
    "open mission",
  );
  await bump(session.id);
}

export async function closeMission(slot: number): Promise<void> {
  const session = await getSession();
  must(
    await db()
      .from("hourly_missions")
      .update({ deadline_time: nowIso() })
      .eq("session_id", session.id)
      .eq("hour_slot", slot)
      .not("opened_at", "is", null),
    "close mission",
  );
  await bump(session.id);
}

export async function reviewSubmission(submissionId: string, decision: SubmissionStatus): Promise<void> {
  const session = await getSession();
  const sub = must(
    await db()
      .from("mission_submissions")
      .update({ status: decision, reviewed_at: decision === "PENDING" ? null : nowIso() })
      .eq("id", submissionId)
      .select("participant_id")
      .maybeSingle<{ participant_id: string }>(),
    "review submission",
  );
  if (!sub) throw badRequest("제출 기록을 찾을 수 없어요.");
  await recomputeUnlock(session.id, sub.participant_id);
  await bump(session.id);
}

/** 힌트 단계 수동 보정 (receiver 가 비밀 마니또에 대해 아는 단계): bonus = 목표 - 포인트 기반 단계 */
export async function setUnlockLevel(chainId: string, level: number): Promise<void> {
  const session = await getSession();
  const chain = (await listChains(session.id)).find((c) => c.id === chainId);
  if (!chain) throw badRequest("매칭을 찾을 수 없어요.");
  const { total } = await hintPoints(session.id, chain.receiver_id);
  const target = clampLevel(level);
  must(
    await db()
      .from("manito_chains")
      .update({ unlocked_level: target, unlock_bonus: target - thresholdLevel(total) })
      .eq("id", chain.id),
    "set unlock level",
  );
  await bump(session.id);
}

// ---------------------------------------------------------------- 배팅
export async function controlBet(action: "open" | "lock" | "result", winningFaction?: Faction): Promise<void> {
  const session = await getSession();
  if (action === "result") {
    if (!winningFaction) throw badRequest("승리 진영을 선택해 주세요.");
    return updateSession(session, { bet_status: "RESULT", winning_faction: winningFaction });
  }
  return updateSession(session, {
    bet_status: action === "open" ? "OPEN" : "LOCKED",
    winning_faction: action === "open" ? null : session.winning_faction,
  });
}

