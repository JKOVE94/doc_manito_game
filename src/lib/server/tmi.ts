import "server-only";
import notionTmi from "@/data/tmi-notion.json";
import { normalizeName, parseTmiText, type TmiBlankQuiz, type TmiFact } from "@/lib/game/tmi";
import { badRequest } from "./http";
import { bump, getSession, listParticipants } from "./repo";
import { db, must } from "./supabase";

export interface FactRow {
  id: string;
  subject_name: string;
  fact: string;
  quiz: TmiBlankQuiz | null;
}

/** 저장소에 포함된 Notion TMI (6명·54개, 시점 의존 정보 제거본) */
export const NOTION_PRESET_JSON = JSON.stringify(notionTmi);

export async function listFacts(sessionId: string): Promise<FactRow[]> {
  return must(
    await db().from("tmi_facts").select("id, subject_name, fact, quiz").eq("session_id", sessionId).order("created_at"),
    "list tmi",
  ) as FactRow[];
}

/** 특정 인물의 TMI (이름 공백 무시 비교) */
export function factsAbout(facts: FactRow[], name: string): string[] {
  const n = normalizeName(name);
  return facts.filter((f) => normalizeName(f.subject_name) === n).map((f) => f.fact);
}

/** 관리자: TMI 전체 교체 */
export async function replaceFacts(text: string): Promise<{ ok: true; factCount: number; quizCount: number }> {
  const parsed: TmiFact[] = parseTmiText(text);
  if (parsed.length === 0) throw badRequest("TMI 를 하나도 읽지 못했어요. 형식을 확인해 주세요. (예: 홍길동: 피아노 10년)");
  const session = await getSession();
  must(await db().from("tmi_facts").delete().eq("session_id", session.id), "clear tmi");
  must(
    await db()
      .from("tmi_facts")
      .insert(parsed.map((f) => ({ session_id: session.id, subject_name: f.name, fact: f.fact, quiz: f.quiz ?? null }))),
    "insert tmi",
  );
  await bump(session.id);
  return { ok: true, factCount: parsed.length, quizCount: parsed.filter((f) => f.quiz).length };
}

export async function tmiSummary(sessionId: string) {
  const [facts, participants] = await Promise.all([listFacts(sessionId), listParticipants(sessionId)]);
  const names = new Set(participants.map((p) => normalizeName(p.name)));
  const counts = new Map<string, number>();
  for (const f of facts) counts.set(f.subject_name, (counts.get(f.subject_name) ?? 0) + 1);
  return {
    factCount: facts.length,
    quizCount: facts.filter((f) => f.quiz).length,
    subjects: [...counts].map(([name, count]) => ({ name, count, matched: names.has(normalizeName(name)) })),
  };
}
