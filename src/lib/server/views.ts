import "server-only";
import { KEYWORD_SLOTS, MIN_PARTICIPANTS, UNLOCK_THRESHOLDS } from "@/lib/config";
import { getHint } from "@/lib/game/choseong";
import type {
  AdminState,
  ChainLinkView,
  EndingView,
  MissionView,
  ParticipantState,
  PersonRef,
  TargetKeywordView,
  TruthLieRevealRow,
} from "@/lib/types";
import { buildAskView } from "./ask";
import { unauthorized } from "./http";
import {
  betCorrect,
  type ChainRow,
  getSession,
  isMissionActive,
  type KeywordRow,
  listBets,
  listChains,
  listKeywords,
  listMissions,
  listParticipants,
  listSubmissions,
  listTruthLie,
  nextUnlockAt,
  type ParticipantRow,
  type SubmissionRow,
  timerView,
} from "./repo";

const ref = (p: ParticipantRow | undefined): PersonRef | null => (p ? { id: p.id, name: p.name } : null);

function approvedCountBy(subs: SubmissionRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of subs) if (s.status === "APPROVED") map.set(s.participant_id, (map.get(s.participant_id) ?? 0) + 1);
  return map;
}

function revealRows(participants: ParticipantRow[], lies: { participant_id: string; lie_turn: number }[]): TruthLieRevealRow[] {
  const byId = new Map(lies.map((l) => [l.participant_id, l.lie_turn]));
  return participants.map((p) => ({ participantId: p.id, name: p.name, lieTurn: byId.get(p.id) ?? null }));
}

function chainLinks(chains: ChainRow[], people: Map<string, ParticipantRow>, approved: Map<string, number>): ChainLinkView[] {
  return chains.map((c) => ({
    position: c.position,
    giver: ref(people.get(c.giver_id)) ?? { id: c.giver_id, name: "(삭제됨)" },
    receiver: ref(people.get(c.receiver_id)) ?? { id: c.receiver_id, name: "(삭제됨)" },
    receiverAlias: people.get(c.receiver_id)?.alias ?? "",
    approvedMissions: approved.get(c.giver_id) ?? 0,
    guess: c.final_guess_id ? ref(people.get(c.final_guess_id)) : null,
    guessCorrect: c.is_guess_correct,
  }));
}

/** 베스트 마니또: 승인 미션 최다 (0 이면 없음), 동률이면 최종 추리 정답자 우선 */
function bestManitos(links: ChainLinkView[]): PersonRef[] {
  const max = Math.max(0, ...links.map((l) => l.approvedMissions));
  if (max === 0) return [];
  const top = links.filter((l) => l.approvedMissions === max);
  const correct = top.filter((l) => l.guessCorrect);
  return (correct.length ? correct : top).map((l) => l.giver);
}

// =====================================================================
export async function buildParticipantState(participantId: string): Promise<ParticipantState> {
  const session = await getSession();
  const participants = await listParticipants(session.id);
  const people = new Map(participants.map((p) => [p.id, p]));
  const me = people.get(participantId);
  if (!me) throw unauthorized("세션이 초기화되었어요. 다시 입장해 주세요.");

  const started = session.status !== "READY";
  const [lies, chains, missions] = await Promise.all([
    listTruthLie(session.id),
    started ? listChains(session.id) : Promise.resolve([] as ChainRow[]),
    started ? listMissions(session.id) : Promise.resolve([]),
  ]);
  const myChain = chains.find((c) => c.giver_id === me.id) ?? null;
  const targetId = myChain?.receiver_id;

  const [keywords, submissions] = await Promise.all([
    listKeywords(targetId ? [me.id, targetId] : [me.id]),
    listSubmissions(missions.map((m) => m.id)),
  ]);
  const myKeywords = keywords.filter((k) => k.participant_id === me.id);
  const approved = approvedCountBy(submissions);
  const myApproved = approved.get(me.id) ?? 0;

  // ---- 타깃 카드
  let target: ParticipantState["target"] = null;
  if (myChain && targetId) {
    const tk = new Map<number, KeywordRow>(
      keywords.filter((k) => k.participant_id === targetId).map((k) => [k.slot_index, k]),
    );
    const level = myChain.unlocked_level;
    target = {
      alias: people.get(targetId)?.alias ?? "익명의 친구",
      unlockedLevel: level,
      keywords: KEYWORD_SLOTS.map(({ slot, label }): TargetKeywordView => {
        const k = tk.get(slot);
        const unlocked = slot <= level;
        const hinted = myChain.hint_solved === true && myChain.hint_slot === slot;
        return {
          slot,
          label,
          value: unlocked ? (k?.keyword_value ?? "(미입력)") : null,
          hint: !unlocked && hinted && k ? getHint(k.keyword_value) : null,
        };
      }),
    };
  }

  // ---- 미션
  const mySubs = new Map(submissions.filter((s) => s.participant_id === me.id).map((s) => [s.mission_id, s]));
  const missionViews: MissionView[] = missions
    .filter((m) => m.opened_at)
    .map((m) => {
      const sub = mySubs.get(m.id);
      return {
        slot: m.hour_slot,
        title: m.title,
        description: m.description,
        openedAt: m.opened_at,
        deadline: m.deadline_time,
        isActive: session.status === "ACTIVE" && isMissionActive(m) && sub?.status !== "APPROVED",
        mySubmission: sub ? { status: sub.status, note: sub.note } : null,
      };
    });

  // ---- 조커
  let joker: ParticipantState["joker"] = null;
  if (myChain && target) {
    const lockedWithKeyword = target.keywords.filter((k) => k.value === null).map((k) => k.slot);
    const targetHasKeyword = new Set(keywords.filter((k) => k.participant_id === targetId).map((k) => k.slot_index));
    joker = {
      used: myChain.hint_used,
      pendingQuiz:
        myChain.hint_used && myChain.hint_solved === null && myChain.hint_quiz
          ? { question: myChain.hint_quiz.question, options: myChain.hint_quiz.options }
          : null,
      solved: myChain.hint_solved,
      slot: myChain.hint_slot,
      available: lockedWithKeyword.some((s) => targetHasKeyword.has(s)),
    };
  }

  // ---- 배팅
  let bet: ParticipantState["bet"] = null;
  if (started) {
    const mine = (await listBets(session.id)).find((b) => b.participant_id === me.id);
    bet = {
      status: session.bet_status,
      mine: mine ? { faction: mine.faction, prediction: mine.prediction } : null,
      winningFaction: session.bet_status === "RESULT" ? session.winning_faction : null,
      myBetCorrect: session.bet_status === "RESULT" ? betCorrect(mine, session.winning_faction) : null,
      hiddenQuest: myChain?.hidden_quest ?? null,
    };
  }

  // ---- 최종 추리 / 엔딩
  const guess: ParticipantState["guess"] =
    myChain && (session.status === "GUESSING" || session.status === "FINISHED")
      ? {
          candidates: participants.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: p.name })),
          myGuess: myChain.final_guess_id ? ref(people.get(myChain.final_guess_id)) : null,
        }
      : null;

  let ending: EndingView | null = null;
  if (session.status === "FINISHED") {
    const links = chainLinks(chains, people, approved);
    const mine = chains.find((c) => c.receiver_id === me.id);
    ending = {
      chain: links,
      bestManitos: bestManitos(links),
      mySecretManito: mine ? ref(people.get(mine.giver_id)) : null,
    };
  }

  const timer = timerView(session);
  return {
    serverNow: new Date().toISOString(),
    revision: session.revision,
    session: { status: session.status, participantCount: participants.length },
    me: {
      id: me.id,
      name: me.name,
      keywords: myKeywords.map((k) => ({ slot: k.slot_index, value: k.keyword_value })),
      lieTurn: lies.find((l) => l.participant_id === me.id)?.lie_turn ?? null,
    },
    keywordSlots: KEYWORD_SLOTS,
    target,
    missions: missionViews,
    approvedMissionCount: myApproved,
    nextUnlockAt: myChain ? nextUnlockAt(myChain.unlocked_level) : UNLOCK_THRESHOLDS[0],
    joker,
    ask: myChain ? await buildAskView(session, me.id, myApproved) : null,
    truthLie: { timer, reveal: timer.revealed ? revealRows(participants, lies) : null },
    bet,
    guess,
    ending,
  };
}

// =====================================================================
export async function buildAdminState(): Promise<AdminState> {
  const session = await getSession();
  const [participants, lies, chains, missions, bets] = await Promise.all([
    listParticipants(session.id),
    listTruthLie(session.id),
    listChains(session.id),
    listMissions(session.id),
    listBets(session.id),
  ]);
  const people = new Map(participants.map((p) => [p.id, p]));
  const [keywords, submissions] = await Promise.all([
    listKeywords(participants.map((p) => p.id)),
    listSubmissions(missions.map((m) => m.id)),
  ]);
  const approved = approvedCountBy(submissions);
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const kwCount = new Map<string, number>();
  for (const k of keywords) kwCount.set(k.participant_id, (kwCount.get(k.participant_id) ?? 0) + 1);
  const lieBy = new Map(lies.map((l) => [l.participant_id, l.lie_turn]));
  const betBy = new Map(bets.map((b) => [b.participant_id, b]));
  const chainBy = new Map(chains.map((c) => [c.giver_id, c]));

  return {
    serverNow: new Date().toISOString(),
    revision: session.revision,
    session: {
      status: session.status,
      startedAt: session.started_at,
      minParticipants: MIN_PARTICIPANTS,
      canStart: session.status === "READY" && participants.length >= MIN_PARTICIPANTS,
    },
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      alias: p.alias,
      keywordCount: kwCount.get(p.id) ?? 0,
      lieTurn: lieBy.get(p.id) ?? null,
      hasBet: betBy.has(p.id),
      hasGuess: !!chainBy.get(p.id)?.final_guess_id,
      createdAt: p.created_at,
    })),
    missions: missions.map((m) => ({
      slot: m.hour_slot,
      title: m.title,
      description: m.description,
      openedAt: m.opened_at,
      deadline: m.deadline_time,
    })),
    submissions: submissions.map((s) => {
      const m = missionById.get(s.mission_id);
      return {
        id: s.id,
        missionSlot: m?.hour_slot ?? 0,
        missionTitle: m?.title ?? "",
        participant: ref(people.get(s.participant_id)) ?? { id: s.participant_id, name: "(삭제됨)" },
        note: s.note,
        status: s.status,
        createdAt: s.created_at,
      };
    }),
    chains: chains.map((c) => {
      const link = chainLinks([c], people, approved)[0];
      return {
        id: c.id,
        position: c.position,
        giver: link.giver,
        receiver: link.receiver,
        receiverAlias: link.receiverAlias,
        unlockedLevel: c.unlocked_level,
        approvedMissions: link.approvedMissions,
        hintUsed: c.hint_used,
        hintSolved: c.hint_solved,
        guess: link.guess,
        guessCorrect: c.is_guess_correct,
      };
    }),
    truthLie: { timer: timerView(session), reveal: revealRows(participants, lies) },
    bets: {
      status: session.bet_status,
      winningFaction: session.winning_faction,
      rows: bets.map((b) => ({
        participant: ref(people.get(b.participant_id)) ?? { id: b.participant_id, name: "(삭제됨)" },
        faction: b.faction,
        prediction: b.prediction,
        correct: session.bet_status === "RESULT" ? betCorrect(b, session.winning_faction) : null,
      })),
    },
    unlockThresholds: [...UNLOCK_THRESHOLDS],
  };
}
