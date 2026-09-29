import { getInitialConsonants } from "./choseong";

/** 비교용 정규화: 소문자 + 공백/문장부호 제거 */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * AI 답변이 잠긴 키워드를 직접 노출하는지 검사.
 * - 원문(2자 이상) 포함 여부
 * - 초성(2자 이상, 한글 키워드) 포함 여부 — 조커 찬스 보상 보호
 * 1글자 키워드는 오탐이 많아 프롬프트 규칙에만 의존.
 */
export function leaksLockedKeyword(answer: string, lockedKeywords: readonly string[]): boolean {
  const a = normalizeForMatch(answer);
  return lockedKeywords.some((kw) => {
    const k = normalizeForMatch(kw);
    if (k.length >= 2 && a.includes(k)) return true;
    const cho = normalizeForMatch(getInitialConsonants(kw));
    return cho !== k && cho.length >= 2 && a.includes(cho);
  });
}
