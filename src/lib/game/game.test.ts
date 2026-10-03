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

import { personalDeadline } from "./away";

describe("personalDeadline (away grace)", () => {
  const m = 60_000;
  const open = 0;
  const due = 60 * m;
  const buffer = 10 * m;

  it("no away → unchanged", () => {
    expect(personalDeadline(open, due, [], 30 * m, buffer)).toEqual({ deadline: due, graceMs: 0 });
  });

  it("left 10 min before deadline, back an hour later → remaining 10 min preserved + buffer", () => {
    const r = personalDeadline(open, due, [{ startedAt: 50 * m, endedAt: 110 * m }], 120 * m, buffer);
    expect(r.deadline).toBe(110 * m + 10 * m + buffer);
  });

  it("still away → deadline keeps moving with now", () => {
    const r1 = personalDeadline(open, due, [{ startedAt: 50 * m, endedAt: null }], 70 * m, buffer);
    const r2 = personalDeadline(open, due, [{ startedAt: 50 * m, endedAt: null }], 90 * m, buffer);
    expect(r2.deadline - r1.deadline).toBe(20 * m);
  });

  it("away before the mission opened counts only from opening; away after deadline ignored", () => {
    expect(personalDeadline(open + 30 * m, due, [{ startedAt: 0, endedAt: 40 * m }], 50 * m, buffer).graceMs).toBe(10 * m + buffer);
    expect(personalDeadline(open, due, [{ startedAt: 70 * m, endedAt: 80 * m }], 90 * m, buffer).graceMs).toBe(0);
  });

  it("multiple periods accumulate, including one that starts inside the extended window", () => {
    const r = personalDeadline(open, due, [
      { startedAt: 10 * m, endedAt: 20 * m },
      { startedAt: 65 * m, endedAt: 75 * m }, // 원래 마감 이후지만 연장된 마감(70분) 전에 시작
    ], 100 * m, buffer);
    expect(r.graceMs).toBe(20 * m + buffer);
  });
});

import notion from "@/data/tmi-notion.json";

describe("Notion TMI preset + blank quizzes", () => {
  const parsed = parseTmiText(JSON.stringify(notion));
  const facts = parsed.map((f, i) => ({ id: `f${i}`, subject_name: f.name, fact: f.fact, quiz: f.quiz ?? null }));
  const people = ["전제니", "오아영", "이용준", "김대현", "김윤진", "권순웅"];

  it("parses all 54 facts with blank quizzes", () => {
    expect(parsed).toHaveLength(54);
    expect(parsed.every((f) => f.quiz && f.quiz.decoys.length === 3)).toBe(true);
    expect(new Set(parsed.map((f) => f.name))).toEqual(new Set(people));
  });

  it("produces both kinds; blank answer is at answerIndex and never about the taker", () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      let seed = s;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const q = buildTmiQuiz(facts, "김대현", people, new Set(), rnd)!;
      kinds.add(q.kind);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      if (q.kind === "BLANK") {
        expect(q.subject).not.toBe("김대현");
        const fact = facts.find((f) => f.id === q.factId)!;
        expect(q.options[q.answerIndex]).toBe(fact.quiz!.answer);
      } else {
        expect(q.options[q.answerIndex]).not.toBe("김대현");
      }
    }
    expect(kinds).toEqual(new Set(["WHO", "BLANK"]));
  });
});

import { matchSubject } from "./tmi";

describe("matchSubject (partial name match)", () => {
  it("exact match wins, ignoring spaces", () => {
    expect(matchSubject("김 대현", ["김대현", "대현"])).toBe("김대현");
  });

  it("matches given name only or full name either way", () => {
    expect(matchSubject("김대현", ["대현", "아영"])).toBe("대현");
    expect(matchSubject("대현", ["김대현", "오아영"])).toBe("김대현");
    expect(matchSubject("오아영", ["아영"])).toBe("아영");
  });

  it("refuses ambiguous or too-short matches", () => {
    expect(matchSubject("김대현", ["대현", "김대"])).toBeNull(); // 후보 2명
    expect(matchSubject("대현", ["김대현", "박대현"])).toBeNull();
    expect(matchSubject("김대현", ["현"])).toBeNull(); // 1글자
    expect(matchSubject("외부인", ["대현"])).toBeNull();
  });

  it("quiz uses partial names and never quizzes the taker about themselves", () => {
    const facts = [
      { id: "a", subject_name: "김대현", fact: "독서왕" },
      { id: "b", subject_name: "오아영", fact: "피자" },
    ];
    for (let i = 0; i < 30; i++) {
      const q = buildTmiQuiz(facts, "대현", ["대현", "아영", "윤진", "순웅"], new Set())!;
      expect(q.factId).toBe("b");
      expect(q.options[q.answerIndex]).toBe("아영");
    }
  });
});
