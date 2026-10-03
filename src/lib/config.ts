import type { KeywordSlotView } from "@/lib/types";

/** 목장 규칙: 최소 참가 인원 */
export const MIN_PARTICIPANTS = 4;

/**
 * 힌트 포인트(승인 미션 + 퀴즈 정답)가 이 값에 도달할 때마다 비밀 마니또 힌트 1단계 해금.
 * 단계: 1~3 키워드(과거 TMI·최근 관심사·달란트), 4 이름 글자 수, 5 이름 초성
 */
export const UNLOCK_THRESHOLDS = [1, 3, 5, 7, 9] as const;
export const MAX_HINT_LEVEL = UNLOCK_THRESHOLDS.length;
export const EXTRA_HINT_LABELS = ["이름 글자 수", "이름 초성"] as const;

/** 수시 TMI 퀴즈: 게임 시작 후 첫 퀴즈 / 이후 간격(분, 무작위) / 응답 제한 시간(초) */
export const QUIZ_FIRST_DELAY_MIN: [number, number] = [3, 10];
export const QUIZ_INTERVAL_MIN: [number, number] = [12, 25];
export const QUIZ_ANSWER_SEC = 180;

/** 질문 우편함: 방향별(내가 섬기는 사람에게 / 비밀 마니또에게) 최대 질문 수 */
export const MAIL_LIMIT_PER_DIRECTION = 3;

/** 미션 인증 사진 버킷 (Supabase Storage, 비공개) */
export const PHOTO_BUCKET = "mission-photos";

export const MISSION_SLOT_COUNT = 8;

export const KEYWORD_SLOTS: KeywordSlotView[] = [
  { slot: 1, label: "과거 TMI" },
  { slot: 2, label: "최근 관심사" },
  { slot: 3, label: "달란트" },
];

/** 미션 기본값 (관리자 콘솔에서 수정 가능) */
export const DEFAULT_MISSIONS: { title: string; description: string }[] = [
  { title: "첫 인사", description: "내가 섬기는 친구에게 진심 어린 칭찬 한마디를 건네고, 그 친구가 나온 사진으로 인증하세요." },
  { title: "간식 배달", description: "들키지 않게 음료나 간식을 친구 자리에 두고 사진으로 인증하세요." },
  { title: "익명 응원 쪽지", description: "응원 쪽지를 몰래 남기고 사진으로 인증하세요. 필체를 숨기면 보너스!" },
  { title: "함께 한 컷", description: "자연스럽게 친구와 함께 사진을 한 장 찍으세요." },
  { title: "기도 제목", description: "친구의 기도 제목을 물어보고 함께 기도한 뒤 메모로 남기세요." },
  { title: "몰래 돕기", description: "정리·설거지 등 친구가 하는 일을 티 나지 않게 돕고 인증하세요." },
  { title: "칭찬 릴레이", description: "모두 앞에서 친구의 장점을 하나 소개하세요." },
  { title: "마지막 선물", description: "준비한 작은 선물이나 편지를 전달하고 사진으로 인증하세요." },
];

/** 시크릿 히틀러 히든 퀘스트 카드 풀 (지지 / 견제) */
export const HIDDEN_QUESTS: string[] = [
  "[지지] 내가 섬기는 친구가 수상 후보가 되면 무조건 찬성(Ja!) 투표하세요.",
  "[지지] 대통령이 되면 내가 섬기는 친구를 수상으로 한 번 지명하세요.",
  "[지지] 내가 섬기는 친구가 의심받을 때 한 번 적극적으로 변호해 주세요.",
  "[견제] 내가 섬기는 친구가 수상 후보가 되면 한 번은 반대(Nein) 투표하세요.",
  "[견제] 게임 중 내가 섬기는 친구의 정체를 한 번 공개적으로 의심해 보세요.",
  "[견제] 대통령 권한(조사)이 생기면 내가 섬기는 친구를 조사하세요.",
  "[연기] 게임 내내 내가 섬기는 친구와 눈을 세 번 이상 마주치고 미소 지으세요.",
  "[연기] 내가 섬기는 친구의 발언에 '역시!'라고 한 번 맞장구 치세요.",
];

/** AI 스무고개 힌트: 기본 질문 수 + 승인 미션 1개당 추가 질문 수 */
export const AI_BASE_QUESTIONS = 3;
export const AI_BONUS_PER_APPROVED_MISSION = 1;
export const AI_MAX_QUESTION_LENGTH = 100;
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

/** 테스트 모드 봇 키워드 풀 (슬롯별) */
export const BOT_KEYWORD_POOL: [string[], string[], string[]] = [
  ["수영선수 출신", "전학 3번", "고양이 집사", "밴드 보컬", "제주도 1년 살기", "태권도 3단"],
  ["클라이밍", "베이킹", "러닝크루", "보드게임", "필름카메라", "캠핑"],
  ["기타 연주", "손글씨", "요리", "사진", "찬양 인도", "그림"],
];
