import "server-only";
import { EXTRA_HINT_LABELS, KEYWORD_SLOTS, MAX_HINT_LEVEL, MIN_PARTICIPANTS, UNLOCK_THRESHOLDS } from "@/lib/config";
import { getHint, getInitialConsonants } from "@/lib/game/choseong";
import type {
  AdminState,
  ChainLinkView,
  EndingView,
  ManitoHintView,
  MissionView,
  ParticipantState,
  PersonRef,
  TruthLieRevealRow,
} from "@/lib/types";
import { buildAskView } from "./ask";
import { unauthorized } from "./http";
import { buildMailbox } from "./mail";
import { ensureQuiz, quizStats } from "./quiz";
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
import { signPhotoUrls } from "./storage";
import { tmiSummary } from "./tmi";

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

/** 각 링크의 guess = receiver 가 "나를 섬긴 사람"으로 지목한 사람 */
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

/** 베스트 마니또: 승인 미션 최다 (0 이면 없음), 동률이면 자기 비밀 마니또를 맞힌 사람 우선 */
function bestManitos(links: ChainLinkView[]): PersonRef[] {
  const max = Math.max(0, ...links.map((l) => l.approvedMissions));
  if (max === 0) return [];
  const guessedRight = new Set(links.filter((l) => l.guessCorrect).map((l) => l.receiver.id));
  const top = links.filter((l) => l.approvedMissions === max);
  const tie = top.filter((l) => guessedRight.has(l.giver.id));
  return (tie.length ? tie : top).map((l) => l.giver);
}

/** 비밀 마니또 힌트 사다리: 1~3 키워드, 4 이름 글자 수, 5 이름 초성 */
function manitoHints(chain: ChainRow, giver: ParticipantRow | undefined, giverKeywords: Map<number, KeywordRow>): ManitoHintView[] {
  const level = chain.unlocked_level;
  const keywordHints = KEYWORD_SLOTS.map(({ slot, label }): ManitoHintView => {
    const k = giverKeywords.get(slot);
    const open = slot <= level;
    const jokered = chain.hint_solved === true && chain.hint_slot === slot;
    return {
      level: slot,
      label,
      value: open ? (k?.keyword_value ?? "(미입력)") : null,
      hint: !open && jokered && k ? getHint(k.keyword_value) : null,
    };
  });
  const name = (giver?.name ?? "").replace(/\s+/g, "");
  const extra = EXTRA_HINT_LABELS.map((label, i): ManitoHintView => {
    const lv = KEYWORD_SLOTS.length + i + 1;
    const value = i === 0 ? `${[...name].length}글자` : getInitialConsonants(name);
    return { level: lv, label, value: lv <= level ? value : null, hint: null };
  });
  return [...keywordHints, ...extra].slice(0, MAX_HINT_LEVEL);
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
  const giveChain = chains.find((c) => c.giver_id === me.id) ?? null; // 나 → 내가 섬기는 사람
  const recvChain = chains.find((c) => c.receiver_id === me.id) ?? null; // 비밀 마니또 → 나

  const keywordOwners = [me.id, giveChain?.receiver_id, recvChain?.giver_id].filter((x): x is string => !!x);
  const [keywords, submissions] = await Promise.all([
    listKeywords([...new Set(keywordOwners)]),
    listSubmissions(missions.map((m) => m.id)),
  ]);
  const kwOf = (pid: string) => new Map(keywords.filter((k) => k.participant_id === pid).map((k) => [k.slot_index, k]));
  const approved = approvedCountBy(submissions);
  const myApproved = approved.get(me.id) ?? 0;

  // ---- 내가 섬기는 사람 (이름 공개)
  const targetPerson = giveChain ? people.get(giveChain.receiver_id) : undefined;
  const target: ParticipantState["target"] =
    giveChain && targetPerson
      ? {
          id: targetPerson.id,
          name: targetPerson.name,
          keywords: KEYWORD_SLOTS.flatMap(({ slot, label }) => {
            const k = kwOf(targetPerson.id).get(slot);
            return k ? [{ slot, label, value: k.keyword_value }] : [];
          }),
        }
      : null;

  // ---- 퀴즈 (포인트 계산 전에 lazy 생성·만료 처리)
  const quiz = started ? await ensureQuiz(session, me, participants.map((p) => p.name)) : null;

  // ---- 나를 섬기는 비밀 마니또 (정체 비공개)
  let manito: ParticipantState["manito"] = null;
  if (recvChain) {
    const quizzes = quiz?.score ?? 0;
    const points = myApproved + quizzes;
    manito = {
      unlockedLevel: recvChain.unlocked_level,
      maxLevel: MAX_HINT_LEVEL,
      hints: manitoHints(recvChain, people.get(recvChain.giver_id), kwOf(recvChain.giver_id)),
      points,
      pointSources: { missions: myApproved, quizzes },
      nextUnlockAt: nextUnlockAt(recvChain.unlocked_level),
    };
  }

  // ---- 미션 (내가 섬기는 사람을 위한 미션, 사진 인증)
  const mySubs = new Map(submissions.filter((s) => s.participant_id === me.id).map((s) => [s.mission_id, s]));
  const photoUrls = await signPhotoUrls([...mySubs.values()].map((s) => s.photo_path));
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
        mySubmission: sub
          ? { status: sub.status, note: sub.note, photoUrl: sub.photo_path ? (photoUrls.get(sub.photo_path) ?? null) : null }
          : null,
      };
    });

  // ---- 조커 (비밀 마니또의 잠긴 키워드 대상)
  let joker: ParticipantState["joker"] = null;
  if (recvChain && manito) {
    const giverHas = new Set(kwOf(recvChain.giver_id).keys());
    joker = {
      used: recvChain.hint_used,
      pendingQuiz:
        recvChain.hint_used && recvChain.hint_solved === null && recvChain.hint_quiz
          ? { question: recvChain.hint_quiz.question, options: recvChain.hint_quiz.options }
          : null,
      solved: recvChain.hint_solved,
      slot: recvChain.hint_slot,
      available: KEYWORD_SLOTS.some(({ slot }) => slot > recvChain.unlocked_level && giverHas.has(slot)),
    };
  }

  // ---- 배팅 (히든 퀘스트는 내가 섬기는 사람 관련)
  let bet: ParticipantState["bet"] = null;
  if (started) {
    const mine = (await listBets(session.id)).find((b) => b.participant_id === me.id);
    bet = {
      status: session.bet_status,
      mine: mine ? { faction: mine.faction, prediction: mine.prediction } : null,
      winningFaction: session.bet_status === "RESULT" ? session.winning_faction : null,
      myBetCorrect: session.bet_status === "RESULT" ? betCorrect(mine, session.winning_faction) : null,
      hiddenQuest: giveChain?.hidden_quest ?? null,
    };
  }

  // ---- 최종 추리: 나를 섬긴 비밀 마니또 지목
  const guess: ParticipantState["guess"] =
    recvChain && (session.status === "GUESSING" || session.status === "FINISHED")
      ? {
          candidates: participants.filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: p.name })),
          myGuess: recvChain.final_guess_id ? ref(people.get(recvChain.final_guess_id)) : null,
        }
      : null;

  let ending: EndingView | null = null;
  if (session.status === "FINISHED") {
    const links = chainLinks(chains, people, approved);
    ending = {
      chain: links,
      bestManitos: bestManitos(links),
      mySecretManito: recvChain ? ref(people.get(recvChain.giver_id)) : null,
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
      keywords: [...kwOf(me.id).values()].map((k) => ({ slot: k.slot_index, value: k.keyword_value })),
      lieTurn: lies.find((l) => l.participant_id === me.id)?.lie_turn ?? null,
    },
    keywordSlots: KEYWORD_SLOTS,
    target,
    manito,
    missions: missionViews,
    approvedMissionCount: myApproved,
    joker,
    ask: giveChain ? await buildAskView(session, me.id, myApproved) : null,
    quiz,
    mailbox: started ? await buildMailbox(giveChain, recvChain, people) : null,
    truthLie: { timer, reveal: timer.revealed ? revealRows(participants, lies) : null },
    bet,
    guess,
    ending,
  };
}

// =====================================================================
export async function buildAdminState(): Promise<AdminState> {
  const session = await getSession();
  const [participants, lies, chains, missions, bets, tmi, quiz] = await Promise.all([
    listParticipants(session.id),
    listTruthLie(session.id),
    listChains(session.id),
    listMissions(session.id),
    listBets(session.id),
    tmiSummary(session.id),
    quizStats(session.id),
  ]);
  const people = new Map(participants.map((p) => [p.id, p]));
  const [keywords, submissions] = await Promise.all([
    listKeywords(participants.map((p) => p.id)),
    listSubmissions(missions.map((m) => m.id)),
  ]);
  const photoUrls = await signPhotoUrls(submissions.map((s) => s.photo_path));
  const approved = approvedCountBy(submissions);
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const kwCount = new Map<string, number>();
  for (const k of keywords) kwCount.set(k.participant_id, (kwCount.get(k.participant_id) ?? 0) + 1);
  const lieBy = new Map(lies.map((l) => [l.participant_id, l.lie_turn]));
  const betBy = new Map(bets.map((b) => [b.participant_id, b]));
  const guessBy = new Map(chains.map((c) => [c.receiver_id, c.final_guess_id]));

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
      isBot: p.is_bot,
      alias: p.alias,
      keywordCount: kwCount.get(p.id) ?? 0,
      lieTurn: lieBy.get(p.id) ?? null,
      hasBet: betBy.has(p.id),
      hasGuess: !!guessBy.get(p.id),
      quizScore: quiz.scoreBy.get(p.id) ?? 0,
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
        photoUrl: s.photo_path ? (photoUrls.get(s.photo_path) ?? null) : null,
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
        receiverPoints: (approved.get(c.receiver_id) ?? 0) + (quiz.scoreBy.get(c.receiver_id) ?? 0),
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
    maxHintLevel: MAX_HINT_LEVEL,
    tmi,
    quiz: { pendingCount: quiz.pendingCount, answeredCount: quiz.answeredCount, correctCount: quiz.correctCount },
    botCount: participants.filter((p) => p.is_bot).length,
  };
}
