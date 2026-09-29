const CHOSEONG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

const HANGUL_SYLLABLE = /[가-힣]/;

/** "피아노" → "ㅍㅇㄴ" (한글 음절 외 문자는 그대로) */
export function getInitialConsonants(input: string): string {
  let result = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    result += code >= 0xac00 && code <= 0xd7a3 ? CHOSEONG[Math.floor((code - 0xac00) / 588)] : ch;
  }
  return result;
}

/** 조커 힌트: 한글이 있으면 초성, 없으면 첫 글자 + 나머지 * 마스킹 ("piano" → "p****") */
export function getHint(input: string): string {
  const s = input.trim();
  if (!s) return "";
  if (HANGUL_SYLLABLE.test(s)) return getInitialConsonants(s);
  const [first, ...rest] = [...s];
  return first + rest.map((ch) => (ch === " " ? " " : "*")).join("");
}
