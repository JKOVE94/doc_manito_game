# task-local.md — Qwen2.5-Coder-7B 지시서
# 각 TASK 는 독립 프롬프트로 개별 실행됨 (구분자: `=====TASK=====`).

=====TASK=====
## Goal
Write a TypeScript module that extracts Korean initial consonants (초성) from a string, and builds a hint string.

## I/O Spec
```ts
export function getInitialConsonants(input: string): string
export function getHint(input: string): string
```
- `getInitialConsonants`:
  - For each character of `input`:
    - If code point is a Hangul syllable (0xAC00 <= code <= 0xD7A3): output `CHOSEONG[Math.floor((code - 0xAC00) / 588)]`.
    - Otherwise output the character unchanged.
  - `CHOSEONG` = `["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]`
  - Examples: `"피아노"` → `"ㅍㅇㄴ"`, `"축구 2개"` → `"ㅊㄱ 2ㄱ"`, `"abc"` → `"abc"`.
- `getHint`:
  - `const s = input.trim()`.
  - If `s` contains at least one Hangul syllable: return `getInitialConsonants(s)`.
  - Otherwise: return first character of `s` + for each remaining character: `" "` if it is a space, else `"*"`.
  - Examples: `"피아노"` → `"ㅍㅇㄴ"`, `"piano"` → `"p****"`, `"a b"` → `"a *"`, `""` → `""`.

## Constraints
- No imports. No external libraries. TypeScript strict mode compatible.
- Iterate with `for (const ch of str)`.
- Declare `CHOSEONG` as a module-level `const` (not exported).

## Output Format
Output ONLY the TypeScript code of the file. No explanation. No markdown fences.

=====TASK=====
## Goal
Write a TypeScript function that builds a single Hamiltonian cycle (secret-santa ring) from a list of ids.

## I/O Spec
```ts
export interface CycleLink<T> { giver: T; receiver: T; position: number }
export function buildSingleCycle<T>(ids: readonly T[], random: () => number = Math.random): CycleLink<T>[]
```
- Throw `new Error("최소 4명 이상이어야 합니다.")` if `ids.length < 4`.
- Throw `new Error("중복된 참가자가 있습니다.")` if `new Set(ids).size !== ids.length`.
- Copy `ids` into a new array `order`, shuffle it with Fisher–Yates using `random()`:
  `for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }`
- Return array of length n where element i is `{ giver: order[i], receiver: order[(i + 1) % n], position: i }`.

## Constraints
- No imports. Do not mutate the input array. TypeScript strict mode compatible.

## Output Format
Output ONLY the TypeScript code of the file. No explanation. No markdown fences.

=====TASK=====
## Goal
Write a TypeScript function that builds 4 multiple-choice options for a quiz: one correct answer plus 3 decoys.

## I/O Spec
```ts
export interface QuizOptions { options: string[]; answerIndex: number }
export function buildQuizOptions(correct: string, decoyPool: readonly string[], random: () => number = Math.random): QuizOptions
```
- `const answer = correct.trim()`.
- Build `candidates`: from `decoyPool`, trim each value, drop empty strings, drop values whose `toLowerCase()` equals `answer.toLowerCase()`, drop duplicates (case-insensitive, keep first occurrence).
- Randomly pick up to 3 values from `candidates` (shuffle a copy with Fisher–Yates using `random()`, then take the first 3).
- If fewer than 3 picked, append values from `FALLBACK_DECOYS` (in order) that are not already used (case-insensitive, also not equal to answer) until there are 3.
- `FALLBACK_DECOYS` (module-level const, exported) = `["피아노", "축구", "요리", "여행", "캠핑", "노래", "독서", "사진", "게임", "등산"]`
- `answerIndex = Math.floor(random() * 4)`. Insert `answer` into the 3 decoys at `answerIndex` so `options.length === 4`.
- Return `{ options, answerIndex }`.

## Constraints
- No imports. Do not mutate inputs. TypeScript strict mode compatible.

## Output Format
Output ONLY the TypeScript code of the file. No explanation. No markdown fences.

=====TASK=====
## Goal
Write a TypeScript function that generates unique anonymous Korean nicknames.

## I/O Spec
```ts
export function generateAliases(count: number, random: () => number = Math.random): string[]
```
- `ADJECTIVES` (module-level const) = `["수줍은", "용감한", "다정한", "엉뚱한", "반짝이는", "졸린", "신나는", "조용한", "씩씩한", "포근한", "재빠른", "느긋한"]`
- `ANIMALS` (module-level const) = `["고래", "여우", "판다", "수달", "펭귄", "다람쥐", "고슴도치", "부엉이", "코알라", "알파카", "햄스터", "돌고래"]`
- Throw `new Error("닉네임 조합이 부족합니다.")` if `count > ADJECTIVES.length * ANIMALS.length` or `count < 0`.
- Build all combinations `` `${adj} ${animal}` `` (adjective outer loop, animal inner loop), shuffle with Fisher–Yates using `random()`, return the first `count` items.
- Additionally, make sure no two returned aliases share the same animal when `count <= ANIMALS.length`: build instead by shuffling ANIMALS and ADJECTIVES separately and pairing `adj[i % ADJECTIVES.length] + " " + animal[i]` for i < count. Use the full-combination method only when `count > ANIMALS.length`.

## Constraints
- No imports. TypeScript strict mode compatible. Write a small internal `shuffle<T>(arr: readonly T[], random: () => number): T[]` helper that returns a new array.

## Output Format
Output ONLY the TypeScript code of the file. No explanation. No markdown fences.
