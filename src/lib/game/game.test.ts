import { describe, expect, it } from "vitest";
import { generateAliases } from "./alias";
import { getHint, getInitialConsonants } from "./choseong";
import { buildSingleCycle } from "./cycle";
import { buildQuizOptions, FALLBACK_DECOYS } from "./quiz";

/** 결정적 테스트용 시드 난수 (mulberry32) */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildSingleCycle", () => {
  it("rejects fewer than 4 participants and duplicates", () => {
    expect(() => buildSingleCycle(["a", "b", "c"])).toThrow("최소 4명");
    expect(() => buildSingleCycle(["a", "b", "c", "a"])).toThrow("중복");
  });

  it.each([4, 5, 7, 12, 20])("forms one closed loop with no mutual pairs (n=%i)", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    for (let seed = 1; seed <= 200; seed++) {
      const links = buildSingleCycle(ids, seeded(seed));
      expect(links).toHaveLength(n);
      const next = new Map(links.map((l) => [l.giver, l.receiver]));
      expect(new Set(links.map((l) => l.giver)).size).toBe(n);
      expect(new Set(links.map((l) => l.receiver)).size).toBe(n);
      for (const l of links) {
        expect(l.giver).not.toBe(l.receiver);
        expect(next.get(l.receiver)).not.toBe(l.giver); // no A→B→A
      }
      // walking from any node visits everyone exactly once before returning
      let cur = ids[0];
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        seen.add(cur);
        cur = next.get(cur)!;
      }
      expect(seen.size).toBe(n);
      expect(cur).toBe(ids[0]);
    }
  });

  it("does not mutate input", () => {
    const ids = ["a", "b", "c", "d"];
    buildSingleCycle(ids, seeded(3));
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});

describe("choseong", () => {
  it("extracts initial consonants", () => {
    expect(getInitialConsonants("피아노")).toBe("ㅍㅇㄴ");
    expect(getInitialConsonants("축구 2개")).toBe("ㅊㄱ 2ㄱ");
    expect(getInitialConsonants("abc")).toBe("abc");
    expect(getInitialConsonants("까치")).toBe("ㄲㅊ");
  });

  it("builds hints", () => {
    expect(getHint(" 피아노 ")).toBe("ㅍㅇㄴ");
    expect(getHint("piano")).toBe("p****");
    expect(getHint("a b")).toBe("a *");
    expect(getHint("")).toBe("");
  });
});

describe("buildQuizOptions", () => {
  it("always returns 4 unique options with the answer at answerIndex", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const q = buildQuizOptions(" 피아노 ", ["축구", "피아노", "축구", " ", "Baking", "baking", "등산"], seeded(seed));
      expect(q.options).toHaveLength(4);
      expect(q.options[q.answerIndex]).toBe("피아노");
      expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
    }
  });

  it("preserves decoy text and fills from fallbacks", () => {
    const q = buildQuizOptions("Baking", ["iPhone"], seeded(1));
    expect(q.options).toContain("iPhone");
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => FALLBACK_DECOYS.includes(o))).toHaveLength(2);
  });
});

describe("generateAliases", () => {
  it("returns unique aliases with distinct animals for small groups", () => {
    const aliases = generateAliases(12, seeded(9));
    expect(new Set(aliases).size).toBe(12);
    expect(new Set(aliases.map((a) => a.split(" ")[1])).size).toBe(12);
  });

  it("supports larger groups and rejects impossible counts", () => {
    expect(new Set(generateAliases(30, seeded(2))).size).toBe(30);
    expect(() => generateAliases(145)).toThrow();
  });
});

import { leaksLockedKeyword } from "./leak";

describe("leaksLockedKeyword", () => {
  it("detects direct mentions ignoring spacing/case/punctuation", () => {
    expect(leaksLockedKeyword("네, 피아노를 칩니다!", ["피아노"])).toBe(true);
    expect(leaksLockedKeyword("피 아 노 맞아요", ["피아노"])).toBe(true);
    expect(leaksLockedKeyword("Yes, she loves BAKING.", ["baking"])).toBe(true);
  });

  it("detects initial-consonant leaks", () => {
    expect(leaksLockedKeyword("초성은 ㅍㅇㄴ 이에요", ["피아노"])).toBe(true);
  });

  it("allows vague hints and ignores single-char keywords", () => {
    expect(leaksLockedKeyword("네, 건반이 있는 악기와 관련 있어요.", ["피아노"])).toBe(false);
    expect(leaksLockedKeyword("몸을 움직이는 취미예요", ["춤"])).toBe(false);
  });
});

import { buildTmiQuiz, parseTmiText } from "./tmi";

describe("parseTmiText", () => {
  it("parses line formats and strips bullets", () => {
    const facts = parseTmiText("- 가영: 피아노 10년 쳤음\n나래 | 매운 거 못 먹음\n다솜\t고양이 3마리\n그냥 문장\n1. 라희: 운동 싫어함");
    expect(facts).toEqual([
      { name: "가영", fact: "피아노 10년 쳤음" },
      { name: "나래", fact: "매운 거 못 먹음" },
      { name: "다솜", fact: "고양이 3마리" },
      { name: "라희", fact: "운동 싫어함" },
    ]);
  });

  it("parses JSON shapes", () => {
    expect(parseTmiText('[{"name":"가영","fact":"a"},{"name":"나래","facts":["b","c"]}]')).toHaveLength(3);
    expect(parseTmiText('{"가영":["a","b"],"나래":"c"}')).toHaveLength(3);
  });

  it("keeps colons inside the fact text", () => {
    expect(parseTmiText("가영: 좋아하는 시간: 새벽 2시")).toEqual([{ name: "가영", fact: "좋아하는 시간: 새벽 2시" }]);
  });
});

describe("buildTmiQuiz", () => {
  const facts = [
    { id: "f1", subject_name: "가 영", fact: "피아노" },
    { id: "f2", subject_name: "나래", fact: "매운맛" },
    { id: "f3", subject_name: "외부인", fact: "x" },
  ];
  const people = ["가영", "나래", "다솜", "라희"];

  it("never quizzes the taker about themselves or unmatched names", () => {
    for (let s = 0; s < 50; s++) {
      const q = buildTmiQuiz(facts, "가영", people, new Set(), () => (s * 0.137) % 1)!;
      expect(q.factId).toBe("f2");
      expect(q.options).toHaveLength(4);
      expect(q.options[q.answerIndex]).toBe("나래");
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("matches names ignoring spaces and skips used facts", () => {
    const q = buildTmiQuiz(facts, "다솜", people, new Set(["f2"]))!;
    expect(q.options[q.answerIndex]).toBe("가영");
    expect(buildTmiQuiz(facts, "다솜", people, new Set(["f1", "f2"]))).toBeNull();
  });

  it("prefers excluding the taker from decoys", () => {
    const q = buildTmiQuiz(facts, "다솜", [...people, "마루"], new Set(["f2"]))!;
    expect(q.options).not.toContain("다솜");
  });
});
