export interface TmiBlankQuiz {
  question: string;
  answer: string;
  decoys: string[]; // 3개
}

export interface TmiFact {
  name: string;
  fact: string;
  quiz?: TmiBlankQuiz;
}

function parseBlankQuiz(raw: unknown): TmiBlankQuiz | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = raw as Record<string, unknown>;
  if (typeof q.question !== "string" || typeof q.answer !== "string" || !Array.isArray(q.decoys)) return undefined;
  const answer = q.answer.trim();
  const decoys = [...new Set(q.decoys.filter((d): d is string => typeof d === "string").map((d) => d.trim()))]
    .filter((d) => d && d !== answer)
    .slice(0, 3);
  if (!q.question.trim() || !answer || decoys.length < 3) return undefined;
  return { question: q.question.trim(), answer, decoys };
}

/** 이름 비교용 정규화 (공백 제거) */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

/**
 * 관리자가 붙여넣은 TMI 텍스트 파싱.
 * - JSON: `[{ name, fact }]`, `[{ name, facts: [] }]`, `{ "이름": ["TMI", ...] }`
 * - 텍스트: 줄마다 `이름: TMI` / `이름 | TMI` / `이름<TAB>TMI` (앞의 `-`, `*`, 숫자. 제거)
 */
export function parseTmiText(text: string): TmiFact[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const out: TmiFact[] = [];
  const push = (name: unknown, fact: unknown, quiz?: unknown) => {
    if (typeof name !== "string" || typeof fact !== "string") return;
    const n = name.trim();
    const f = fact.trim();
    if (!n || !f || n.length > 30 || f.length > 300) return;
    const q = parseBlankQuiz(quiz);
    out.push(q ? { name: n, fact: f, quiz: q } : { name: n, fact: f });
  };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data: unknown = JSON.parse(trimmed);
      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          if (Array.isArray(r.facts)) for (const f of r.facts) push(r.name, f);
          else push(r.name, r.fact, r.quiz);
        }
      } else if (data && typeof data === "object") {
        for (const [name, facts] of Object.entries(data as Record<string, unknown>)) {
          if (Array.isArray(facts)) for (const f of facts) push(name, f);
          else push(name, facts);
        }
      }
      return out;
    } catch {
      // JSON 이 아니면 줄 단위로 처리
    }
  }

  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    const m = line.match(/^([^:|\t]{1,30}?)\s*(?::|\||\t)\s*(.+)$/);
    if (m) push(m[1], m[2]);
  }
  return out;
}

export interface TmiQuiz {
  factId: string;
  kind: "WHO" | "BLANK";
  /** BLANK 일 때 주인공 이름 */
  subject: string | null;
  question: string;
  options: string[];
  answerIndex: number;
}

function shuffle<T>(arr: readonly T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 빈칸 퀴즈가 있는 TMI 를 빈칸 퀴즈로 낼 확률 (나머지는 "누구의 TMI?") */
export const BLANK_QUIZ_RATIO = 0.6;

/**
 * 수시 퀴즈 1문제 생성.
 * - 주인공이 참가자 이름과 일치하는 TMI 만, 본인 TMI·이미 낸 TMI 제외
 * - WHO: "이 TMI 의 주인공은?" (오답 = 다른 참가자 이름, 가능하면 푸는 사람 제외)
 * - BLANK: Notion 빈칸 퀴즈 (정답 + 오답 3개)
 */
export function buildTmiQuiz(
  facts: readonly { id: string; subject_name: string; fact: string; quiz?: TmiBlankQuiz | null }[],
  takerName: string,
  participantNames: readonly string[],
  usedFactIds: ReadonlySet<string>,
  random: () => number = Math.random,
): TmiQuiz | null {
  const byNorm = new Map(participantNames.map((n) => [normalizeName(n), n]));
  const taker = normalizeName(takerName);
  const candidates = facts.filter((f) => {
    const subj = normalizeName(f.subject_name);
    return byNorm.has(subj) && subj !== taker && !usedFactIds.has(f.id);
  });
  if (candidates.length === 0) return null;

  const fact = candidates[Math.floor(random() * candidates.length)];
  const subject = byNorm.get(normalizeName(fact.subject_name))!;

  if (fact.quiz && random() < BLANK_QUIZ_RATIO) {
    const options = shuffle([fact.quiz.answer, ...fact.quiz.decoys.slice(0, 3)], random);
    return {
      factId: fact.id,
      kind: "BLANK",
      subject,
      question: fact.quiz.question,
      options,
      answerIndex: options.indexOf(fact.quiz.answer),
    };
  }

  const others = participantNames.filter((n) => n !== subject);
  const preferred = shuffle(others.filter((n) => normalizeName(n) !== taker), random);
  const decoys = [...preferred, ...others.filter((n) => normalizeName(n) === taker)].slice(0, 3);
  if (decoys.length < 1) return null;
  const answerIndex = Math.floor(random() * (decoys.length + 1));
  const options = [...decoys];
  options.splice(answerIndex, 0, subject);
  return { factId: fact.id, kind: "WHO", subject: null, question: fact.fact, options, answerIndex };
}
