import type { KeywordSlotView } from "@/lib/types";

/** 목장 규칙: 최소 참가 인원 */
export const MIN_PARTICIPANTS = 4;

/** 누적 승인 미션 수가 이 값에 도달할 때마다 타깃 키워드 1개 해금 (슬롯 1 → 2 → 3) */
export const UNLOCK_THRESHOLDS = [1, 3, 5] as const;

export const MISSION_SLOT_COUNT = 8;

export const KEYWORD_SLOTS: KeywordSlotView[] = [
  { slot: 1, label: "과거 TMI" },
  { slot: 2, label: "최근 관심사" },
  { slot: 3, label: "달란트" },
];

/** 미션 기본값 (관리자 콘솔에서 수정 가능) */
export const DEFAULT_MISSIONS: { title: string; description: string }[] = [
  { title: "첫 인사", description: "마니또 대상이라고 생각되는 사람에게 진심 어린 칭찬 한마디를 건네세요." },
  { title: "간식 배달", description: "대상이라고 추측되는 사람에게 들키지 않게 음료나 간식을 전달하세요." },
  { title: "익명 응원 쪽지", description: "대상에게 응원 쪽지를 몰래 남기세요. 필체를 숨기면 보너스!" },
  { title: "함께 한 컷", description: "대상 후보와 자연스럽게 사진을 한 장 찍으세요." },
  { title: "기도 제목", description: "대상 후보의 기도 제목을 물어보고 함께 기도해 주세요." },
  { title: "몰래 돕기", description: "정리·설거지 등 대상이 하는 일을 티 나지 않게 도와주세요." },
  { title: "칭찬 릴레이", description: "모두 앞에서 대상 후보의 장점을 하나 소개하세요." },
  { title: "마지막 선물", description: "준비한 작은 선물이나 편지를 대상에게 전달하세요." },
];

/** 시크릿 히틀러 히든 퀘스트 카드 풀 (지지 / 견제) */
export const HIDDEN_QUESTS: string[] = [
  "[지지] 마니또 대상이라고 생각되는 사람이 수상 후보가 되면 무조건 찬성(Ja!) 투표하세요.",
  "[지지] 대통령이 되면 마니또 대상이라고 생각되는 사람을 수상으로 한 번 지명하세요.",
  "[지지] 대상 후보가 의심받을 때 한 번 적극적으로 변호해 주세요.",
  "[견제] 대상 후보가 수상 후보가 되면 한 번은 반대(Nein) 투표하세요.",
  "[견제] 게임 중 대상 후보의 정체를 한 번 공개적으로 의심해 보세요.",
  "[견제] 대통령 권한(조사)이 생기면 대상 후보를 조사하세요.",
  "[연기] 게임 내내 대상 후보와 눈을 세 번 이상 마주치고 미소 지으세요.",
  "[연기] 대상 후보의 발언에 '역시!'라고 한 번 맞장구 치세요.",
];

/** AI 스무고개 힌트: 기본 질문 수 + 승인 미션 1개당 추가 질문 수 */
export const AI_BASE_QUESTIONS = 3;
export const AI_BONUS_PER_APPROVED_MISSION = 1;
export const AI_MAX_QUESTION_LENGTH = 100;
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
