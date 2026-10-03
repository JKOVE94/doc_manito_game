export interface TmiFact {
  name: string;
  fact: string;
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
  const push = (name: unknown, fact: unknown) => {
    if (typeof name !== "string" || typeof fact !== "string") return;
    const n = name.trim();
    const f = fact.trim();
    if (n && f && n.length <= 30 && f.length <= 300) out.push({ name: n, fact: f });
  };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data: unknown = JSON.parse(trimmed);
      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          if (Array.isArray(r.facts)) for (const f of r.facts) push(r.name, f);
          else push(r.name, r.fact);
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

/**
 * "이 TMI 의 주인공은?" 4지선다 생성.
 * - 주인공이 참가자 이름과 일치하는 TMI 만, 본인 TMI·이미 낸 TMI 제외
 * - 오답 보기는 다른 참가자 이름 (가능하면 퀴즈 푸는 사람 제외)
 */
export function buildTmiQuiz(
  facts: readonly { id: string; subject_name: string; fact: string }[],
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
  const answer = byNorm.get(normalizeName(fact.subject_name))!;
  const others = participantNames.filter((n) => n !== answer);
  const preferred = shuffle(others.filter((n) => normalizeName(n) !== taker), random);
  const decoys = [...preferred, ...others.filter((n) => normalizeName(n) === taker)].slice(0, 3);
  if (decoys.length < 1) return null;

  const answerIndex = Math.floor(random() * (decoys.length + 1));
  const options = [...decoys];
  options.splice(answerIndex, 0, answer);
  return { factId: fact.id, question: fact.fact, options, answerIndex };
}
