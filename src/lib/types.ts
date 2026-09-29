// =====================================================================
// API 계약 (Server ⇄ Client 공용 타입)
// UI 코드는 이 파일의 타입만 신뢰할 것. 필드 추가/변경은 PM(Claude) 승인 후에만.
// =====================================================================

export type SessionStatus = "READY" | "ACTIVE" | "GUESSING" | "FINISHED";
export type TimerStatus = "IDLE" | "RUNNING" | "PAUSED" | "ENDED";
export type BetStatus = "OPEN" | "LOCKED" | "RESULT";
export type Faction = "LIBERAL" | "FASCIST";
export type Prediction = "WIN" | "LOSE";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

/** 모든 API 에러 응답 형태 (HTTP 4xx/5xx) */
export interface ApiError {
  error: string; // 사용자에게 그대로 보여줘도 되는 한국어 메시지
}

/** 거짓·진실 게임 타이머 (서버 기준 시각으로 계산) */
export interface TimerView {
  status: TimerStatus;
  durationSec: number;
  /** RUNNING 일 때 종료 시각(ISO). 클라이언트는 serverNow 와의 오프셋으로 보정해 카운트다운 */
  endsAt: string | null;
  /** PAUSED/IDLE 일 때 남은 초 */
  remainingSec: number;
  revealed: boolean;
}

export interface KeywordSlotView {
  slot: 1 | 2 | 3;
  label: string; // "과거 TMI" | "최근 관심사" | "달란트"
}

/** 내 타깃(내가 섬기는 대상)의 키워드 한 칸 */
export interface TargetKeywordView {
  slot: 1 | 2 | 3;
  label: string;
  /** 해금되었으면 원문, 아니면 null */
  value: string | null;
  /** 조커 찬스로 얻은 힌트 (초성 또는 첫 글자). 해금 전에만 의미 있음 */
  hint: string | null;
}

export interface MissionView {
  slot: number; // 1~8
  title: string;
  description: string;
  openedAt: string | null;
  deadline: string | null;
  /** 지금 제출 가능한지 (오픈됨 && 마감 전 && 미승인) */
  isActive: boolean;
  mySubmission: { status: SubmissionStatus; note: string } | null;
}

export interface JokerQuizView {
  question: string;
  options: string[]; // 4개
}

export interface JokerView {
  used: boolean;
  /** 사용했지만 아직 답을 제출하지 않았으면 퀴즈가 들어있음 */
  pendingQuiz: JokerQuizView | null;
  /** 답 제출 결과: true 정답 / false 오답 / null 미제출 */
  solved: boolean | null;
  /** 조커 대상이 된 키워드 슬롯 */
  slot: number | null;
  /** 사용 가능한 미해금 키워드가 있는지 */
  available: boolean;
}

export interface BetView {
  status: BetStatus;
  mine: { faction: Faction; prediction: Prediction } | null;
  winningFaction: Faction | null;
  /** RESULT 상태에서 내 배팅 적중 여부 */
  myBetCorrect: boolean | null;
  hiddenQuest: string | null;
}

export interface TruthLieRevealRow {
  participantId: string;
  name: string;
  lieTurn: number | null; // 미제출자는 null
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface ChainLinkView {
  position: number;
  giver: PersonRef;
  receiver: PersonRef;
  receiverAlias: string;
  approvedMissions: number;
  guess: PersonRef | null;
  guessCorrect: boolean | null;
}

export interface EndingView {
  /** position 순으로 정렬된 전체 순환 고리 (A→B→C→…→A) */
  chain: ChainLinkView[];
  /** 베스트 마니또 (승인 미션 수 최다, 동률 시 정답자 우선) */
  bestManitos: PersonRef[];
  /** 나를 섬긴 사람 (나의 비밀 마니또) */
  mySecretManito: PersonRef | null;
}

export type AskVerdict = "YES" | "NO" | "PARTLY" | "UNKNOWN";

export interface AskEntryView {
  question: string;
  verdict: AskVerdict; // 예 / 아니오 / 조금 / 알 수 없음
  answer: string; // 한 문장 힌트
  createdAt: string;
}

/** AI 스무고개 힌트 (타깃에 대해 자연어로 질문) */
export interface AskView {
  /** 서버에 GEMINI_API_KEY 가 설정되어 있고 게임이 ACTIVE 인지 */
  enabled: boolean;
  remaining: number;
  total: number; // 기본 + 승인 미션 보너스
  maxLength: number;
  history: AskEntryView[]; // 오래된 순
}

/** POST /api/me/ask 응답 */
export interface AskResult extends AskEntryView {
  remaining: number;
}

/** GET /api/me/state 응답 */
export interface ParticipantState {
  serverNow: string;
  revision: number;
  session: {
    status: SessionStatus;
    participantCount: number;
  };
  me: {
    id: string;
    name: string;
    keywords: { slot: number; value: string }[]; // 내가 입력한 키워드
    lieTurn: number | null;
  };
  keywordSlots: KeywordSlotView[];
  /** ACTIVE 이후에만 존재 */
  target: {
    alias: string;
    unlockedLevel: number; // 0~3
    keywords: TargetKeywordView[];
  } | null;
  missions: MissionView[]; // 오픈된 미션만 (slot 오름차순)
  approvedMissionCount: number;
  /** 다음 키워드 해금까지 필요한 누적 승인 수 (모두 해금 시 null) */
  nextUnlockAt: number | null;
  joker: JokerView | null; // ACTIVE 이후
  ask: AskView | null; // ACTIVE 이후
  truthLie: {
    timer: TimerView;
    /** revealed=true 일 때만 채워짐 */
    reveal: TruthLieRevealRow[] | null;
  };
  bet: BetView | null; // ACTIVE 이후
  guess: {
    /** GUESSING 단계에서 고를 수 있는 후보 (나 제외) */
    candidates: PersonRef[];
    myGuess: PersonRef | null;
  } | null;
  /** FINISHED 일 때만 */
  ending: EndingView | null;
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export interface AdminParticipantRow {
  id: string;
  name: string;
  alias: string | null;
  keywordCount: number; // 0~3
  lieTurn: number | null;
  hasBet: boolean;
  hasGuess: boolean;
  createdAt: string;
}

export interface AdminSubmissionRow {
  id: string;
  missionSlot: number;
  missionTitle: string;
  participant: PersonRef;
  note: string;
  status: SubmissionStatus;
  createdAt: string;
}

export interface AdminMissionRow {
  slot: number;
  title: string;
  description: string;
  openedAt: string | null;
  deadline: string | null;
}

export interface AdminChainRow {
  id: string;
  position: number;
  giver: PersonRef;
  receiver: PersonRef;
  receiverAlias: string;
  unlockedLevel: number;
  approvedMissions: number;
  hintUsed: boolean;
  hintSolved: boolean | null;
  guess: PersonRef | null;
  guessCorrect: boolean | null;
}

export interface AdminBetRow {
  participant: PersonRef;
  faction: Faction;
  prediction: Prediction;
  correct: boolean | null;
}

/** GET /api/admin/state 응답 */
export interface AdminState {
  serverNow: string;
  revision: number;
  session: {
    status: SessionStatus;
    startedAt: string | null;
    minParticipants: number;
    canStart: boolean;
  };
  participants: AdminParticipantRow[];
  missions: AdminMissionRow[]; // 항상 8개 (slot 1~8)
  submissions: AdminSubmissionRow[]; // 최신순
  chains: AdminChainRow[]; // ACTIVE 이후, position 순
  truthLie: {
    timer: TimerView;
    reveal: TruthLieRevealRow[]; // 관리자는 항상 볼 수 있음
  };
  bets: {
    status: BetStatus;
    winningFaction: Faction | null;
    rows: AdminBetRow[];
  };
  unlockThresholds: number[];
}
