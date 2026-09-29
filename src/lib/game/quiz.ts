export const FALLBACK_DECOYS = ["피아노", "축구", "요리", "여행", "캠핑", "노래", "독서", "사진", "게임", "등산"];

export interface QuizOptions {
  options: string[];
  answerIndex: number;
}

function shuffle<T>(arr: readonly T[], random: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 정답 1 + 오답 3 → 4지선다 (오답 부족 시 FALLBACK_DECOYS 로 채움) */
export function buildQuizOptions(
  correct: string,
  decoyPool: readonly string[],
  random: () => number = Math.random,
): QuizOptions {
  const answer = correct.trim();
  const seen = new Set([answer.toLowerCase()]);
  const candidates: string[] = [];
  for (const raw of decoyPool) {
    const v = raw.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    candidates.push(v);
  }

  const decoys = shuffle(candidates, random).slice(0, 3);
  for (const f of FALLBACK_DECOYS) {
    if (decoys.length >= 3) break;
    if (!seen.has(f.toLowerCase())) {
      seen.add(f.toLowerCase());
      decoys.push(f);
    }
  }

  const answerIndex = Math.floor(random() * 4);
  const options = [...decoys];
  options.splice(answerIndex, 0, answer);
  return { options, answerIndex };
}
