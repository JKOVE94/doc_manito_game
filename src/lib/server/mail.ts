import "server-only";
import { MAIL_LIMIT_PER_DIRECTION } from "@/lib/config";
import type { InboxItemView, MailboxView, MailItemView } from "@/lib/types";
import { badRequest, conflict, HttpError } from "./http";
import { bump, type ChainRow, getChainByGiver, getChainByReceiver, getSession, type ParticipantRow } from "./repo";
import { db, must } from "./supabase";

interface MailRow {
  id: string;
  chain_id: string;
  direction: "TO_TARGET" | "TO_MANITO";
  question: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

const toItem = (m: MailRow): MailItemView => ({
  id: m.id,
  question: m.question,
  answer: m.answer,
  createdAt: m.created_at,
  answeredAt: m.answered_at,
});

async function mailsFor(chainIds: string[]): Promise<MailRow[]> {
  if (chainIds.length === 0) return [];
  return must(
    await db()
      .from("mails")
      .select("id, chain_id, direction, question, answer, created_at, answered_at")
      .in("chain_id", chainIds)
      .order("created_at"),
    "list mails",
  ) as MailRow[];
}

/**
 * giveChain = 나→내가 섬기는 사람, recvChain = 비밀 마니또→나
 * - toTarget  : giveChain / TO_TARGET  (상대는 나를 모름)
 * - toManito  : recvChain / TO_MANITO  (상대는 나를 앎)
 * - inbox     : recvChain / TO_TARGET (비밀 마니또가 보냄, 익명) + giveChain / TO_MANITO (내가 섬기는 사람이 보냄)
 */
export async function buildMailbox(
  giveChain: ChainRow | null,
  recvChain: ChainRow | null,
  people: Map<string, ParticipantRow>,
): Promise<MailboxView> {
  const mails = await mailsFor([giveChain?.id, recvChain?.id].filter((x): x is string => !!x));
  const pick = (chain: ChainRow | null, dir: MailRow["direction"]) =>
    chain ? mails.filter((m) => m.chain_id === chain.id && m.direction === dir) : [];

  const toTarget = pick(giveChain, "TO_TARGET");
  const toManito = pick(recvChain, "TO_MANITO");
  const targetName = giveChain ? (people.get(giveChain.receiver_id)?.name ?? "내가 섬기는 친구") : "";
  const inbox: InboxItemView[] = [
    ...pick(recvChain, "TO_TARGET").map((m) => ({ ...toItem(m), from: "MY_MANITO" as const, fromLabel: "🎭 비밀 마니또" })),
    ...pick(giveChain, "TO_MANITO").map((m) => ({ ...toItem(m), from: "MY_TARGET" as const, fromLabel: targetName })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    limit: MAIL_LIMIT_PER_DIRECTION,
    toTarget: { remaining: Math.max(0, MAIL_LIMIT_PER_DIRECTION - toTarget.length), items: toTarget.map(toItem) },
    toManito: { remaining: Math.max(0, MAIL_LIMIT_PER_DIRECTION - toManito.length), items: toManito.map(toItem) },
    inbox,
    unansweredCount: inbox.filter((m) => !m.answer).length,
  };
}

export async function sendMail(participantId: string, to: "TARGET" | "MANITO", rawQuestion: string): Promise<void> {
  const question = rawQuestion.trim();
  if (question.length < 2 || question.length > 200) throw badRequest("질문은 2~200자로 입력해 주세요.");
  const session = await getSession();
  if (session.status !== "ACTIVE" && session.status !== "GUESSING") throw conflict("게임 진행 중에만 질문할 수 있어요.");
  const chain =
    to === "TARGET" ? await getChainByGiver(session.id, participantId) : await getChainByReceiver(session.id, participantId);
  if (!chain) throw conflict("매칭 정보를 찾을 수 없어요.");
  const direction = to === "TARGET" ? "TO_TARGET" : "TO_MANITO";

  const { count, error } = await db()
    .from("mails")
    .select("id", { count: "exact", head: true })
    .eq("chain_id", chain.id)
    .eq("direction", direction);
  if (error) throw new Error(`[db] count mails: ${error.message}`);
  if ((count ?? 0) >= MAIL_LIMIT_PER_DIRECTION) {
    throw new HttpError(429, `이 상대에게는 질문을 ${MAIL_LIMIT_PER_DIRECTION}번까지만 보낼 수 있어요.`);
  }
  must(await db().from("mails").insert({ session_id: session.id, chain_id: chain.id, direction, question }), "send mail");
  await bump(session.id);
}

export async function answerMail(participantId: string, mailId: string, rawAnswer: string): Promise<void> {
  const answer = rawAnswer.trim();
  if (answer.length < 1 || answer.length > 300) throw badRequest("답장은 1~300자로 입력해 주세요.");
  const session = await getSession();
  const mail = must(
    await db()
      .from("mails")
      .select("id, chain_id, direction, answer, manito_chains(giver_id, receiver_id)")
      .eq("id", mailId)
      .eq("session_id", session.id)
      .maybeSingle<{
        id: string;
        direction: MailRow["direction"];
        answer: string | null;
        manito_chains: { giver_id: string; receiver_id: string } | null;
      }>(),
    "load mail",
  );
  const chain = mail?.manito_chains;
  // TO_TARGET 은 receiver 가, TO_MANITO 는 giver 가 답장
  const recipient = mail && chain ? (mail.direction === "TO_TARGET" ? chain.receiver_id : chain.giver_id) : null;
  if (!mail || recipient !== participantId) throw badRequest("답장할 수 없는 질문이에요.");
  if (mail.answer) throw conflict("이미 답장했어요.");
  const saved = must(
    await db()
      .from("mails")
      .update({ answer, answered_at: new Date().toISOString() })
      .eq("id", mail.id)
      .is("answer", null)
      .select("id")
      .maybeSingle(),
    "answer mail",
  );
  if (!saved) throw conflict("이미 답장했어요.");
  await bump(session.id);
}

/** 봇 테스트용: 봇에게 온 미답장 질문에 자동 답장 */
export async function botAnswerMails(sessionId: string, botIds: Set<string>): Promise<number> {
  const rows = must(
    await db()
      .from("mails")
      .select("id, direction, answer, manito_chains(giver_id, receiver_id)")
      .eq("session_id", sessionId)
      .is("answer", null),
    "bot mails",
  ) as unknown as { id: string; direction: MailRow["direction"]; manito_chains: { giver_id: string; receiver_id: string } }[];
  let n = 0;
  for (const m of rows) {
    const recipient = m.direction === "TO_TARGET" ? m.manito_chains.receiver_id : m.manito_chains.giver_id;
    if (!botIds.has(recipient)) continue;
    await db()
      .from("mails")
      .update({ answer: "🤖 봇의 자동 답장이에요! 좋은 질문 고마워요.", answered_at: new Date().toISOString() })
      .eq("id", m.id)
      .is("answer", null);
    n++;
  }
  return n;
}
