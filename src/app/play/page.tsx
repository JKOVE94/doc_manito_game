"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import { useLiveState } from "@/lib/client/useLiveState";
import type { ParticipantState, SessionStatus } from "@/lib/types";

import { TimerBanner } from "@/components/play/TimerBanner";
import { PrepView } from "@/components/play/PrepView";
import { TargetCard } from "@/components/play/TargetCard";
import { ManitoCard } from "@/components/play/ManitoCard";
import { AskPanel } from "@/components/play/AskPanel";
import { JokerModal } from "@/components/play/JokerModal";
import { MissionList } from "@/components/play/MissionList";
import { MailboxPanel } from "@/components/play/MailboxPanel";
import { QuizModal } from "@/components/play/QuizModal";
import { TruthLiePanel } from "@/components/play/TruthLiePanel";
import { BetPanel } from "@/components/play/BetPanel";
import { GuessCard } from "@/components/play/GuessCard";
import { EndingView } from "@/components/play/EndingView";
import { ShuffleReveal } from "@/components/play/ShuffleReveal";
import { AwayControl } from "@/components/play/AwayControl";
import { MyInfoModal } from "@/components/play/MyInfoModal";

type ActiveTab = "target" | "missions" | "mailbox" | "truthLie" | "bet";

const STATUS_LABELS: Record<SessionStatus, { label: string; tone: "neutral" | "brand" | "warn" | "accent" }> = {
  READY: { label: "준비중", tone: "neutral" },
  ACTIVE: { label: "진행중", tone: "brand" },
  GUESSING: { label: "최종추리", tone: "warn" },
  FINISHED: { label: "결과공개", tone: "accent" },
};

export default function PlayPage() {
  const router = useRouter();
  const { data, error, refresh, clockOffsetMs } = useLiveState<ParticipantState>("/api/me/state");

  const [activeTab, setActiveTab] = useState<ActiveTab>("target");
  const [jokerModalOpen, setJokerModalOpen] = useState(false);
  const [dismissedPendingQuiz, setDismissedPendingQuiz] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [revealDone, setRevealDone] = useState<string | null>(null);
  const [showAwayConfirm, setShowAwayConfirm] = useState(false);

  // 1. Auth check: 401 -> redirect to login
  useEffect(() => {
    if (error && error.status === 401) {
      router.replace("/");
    }
  }, [error, router]);

  // Modal open condition: explicit user open or pending quiz (unless dismissed)
  const isJokerModalVisible =
    jokerModalOpen ||
    (Boolean(data?.joker?.pendingQuiz) && !dismissedPendingQuiz);

  const handleCloseJoker = () => {
    setJokerModalOpen(false);
    if (data?.joker?.pendingQuiz) {
      setDismissedPendingQuiz(true);
    }
  };

  const handleOpenJoker = () => {
    setDismissedPendingQuiz(false);
    setJokerModalOpen(true);
  };

  // Loading state
  if (!data && !error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-ink-soft">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm font-medium">게임 상태 불러오는 중…</p>
        </div>
      </main>
    );
  }

  // Error state (non-401)
  if (error && error.status !== 401 && !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <span className="text-3xl" aria-hidden="true">
            ⚠️
          </span>
          <h2 className="mt-2 text-base font-bold text-ink">
            연결에 실패했습니다
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            {error instanceof ApiRequestError ? error.message : "네트워크 오류가 발생했습니다."}
          </p>
          <Button
            variant="primary"
            onClick={() => void refresh()}
            className="mt-4 w-full"
          >
            다시 시도
          </Button>
        </Card>
      </main>
    );
  }

  if (!data) return null;

  const sessionStatus = data.session.status;

  // 셔플 공개 연출: 판(startedAt)마다 사람당 한 번
  const revealKey = `manito-reveal:${data.me.id}:${data.session.startedAt ?? ""}`;
  const readSeen = () => {
    try {
      return localStorage.getItem(revealKey) === "1";
    } catch {
      return false;
    }
  };
  const showReveal =
    sessionStatus === "ACTIVE" && !!data.target && !!data.session.startedAt && revealDone !== revealKey && !readSeen();
  const finishReveal = () => {
    try {
      localStorage.setItem(revealKey, "1");
    } catch {
      // 저장 불가 환경에서는 이번 세션 동안만 닫힘
    }
    setRevealDone(revealKey);
  };
  const statusInfo = STATUS_LABELS[sessionStatus] ?? { label: sessionStatus, tone: "neutral" };
  const isDashboardMode = sessionStatus === "ACTIVE" || sessionStatus === "GUESSING";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", {});
      router.replace("/");
    } catch {
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {infoOpen && <MyInfoModal state={data} onClose={() => setInfoOpen(false)} />}
      {showReveal && data.target && (
        <ShuffleReveal
          targetName={data.target.name}
          targetKeywords={data.target.keywords.map((k) => ({ label: k.label, value: k.value }))}
          pool={data.roster.filter((n) => n !== data.me.name)}
          onDone={finishReveal}
        />
      )}
      {/* Sticky Mini Timer Banner across all screens when timer is RUNNING or PAUSED */}
      <TimerBanner
        timer={data.truthLie.timer}
        clockOffsetMs={clockOffsetMs}
        onNavigateToGame={() => {
          if (isDashboardMode) {
            setActiveTab("truthLie");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      />

      {/* Spontaneous TMI Quiz Modal across all tabs */}
      {data.quiz?.pending && (
        <QuizModal
          quiz={data.quiz.pending}
          clockOffsetMs={clockOffsetMs}
          refresh={refresh}
        />
      )}

      {/* Main Container */}
      <div className={`mx-auto w-full max-w-md px-4 pt-4 ${isDashboardMode ? "pb-24" : "pb-8"}`}>
        {/* Common Header */}
        <header className="mb-4 flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-lg min-[400px]:flex">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-ink">{data.me.name}</span>
                <span className="text-[11px] text-ink-soft">님</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                {data.quiz && (
                  <Badge tone="accent">
                    🧠 {data.quiz.score}점
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isDashboardMode && !data.me.awaySince && (
              <AwayControl.Button
                onClick={() => setShowAwayConfirm((prev) => !prev)}
                active={showAwayConfirm}
              />
            )}
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label="내 정보 보기"
              title="내 정보"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-lg transition active:scale-95"
            >
              📋
            </button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              loading={loggingOut}
              disabled={loggingOut}
              className="!min-h-9 !px-2 text-xs whitespace-nowrap text-ink-soft hover:text-ink"
            >
              로그아웃
            </Button>
          </div>
        </header>

        {/* AwayControl: 자리비움 배너 / 인라인 확인 (ACTIVE / GUESSING) */}
        {isDashboardMode && (
          <div className={data.me.awaySince || showAwayConfirm ? "mb-4" : ""}>
            <AwayControl
              awaySince={data.me.awaySince}
              clockOffsetMs={clockOffsetMs}
              refresh={refresh}
              confirming={showAwayConfirm}
              onCloseConfirm={() => setShowAwayConfirm(false)}
            />
          </div>
        )}

        {/* View Mode 1: READY (사전 준비 뷰) */}
        {sessionStatus === "READY" && (
          <PrepView state={data} refresh={refresh} />
        )}

        {/* View Mode 2: ACTIVE / GUESSING (메인 대시보드) */}
        {isDashboardMode && (
          <div className="flex flex-col gap-4">
            {/* If GUESSING: Top Guess Card */}
            {sessionStatus === "GUESSING" && data.guess && (
              <GuessCard
                guess={data.guess}
                refresh={refresh}
              />
            )}

            {/* Tab 1: 마니또 */}
            {activeTab === "target" && (
              <div className="flex flex-col gap-4">
                {/* 내가 섬기는 친구 카드 */}
                {data.target ? (
                  <TargetCard target={data.target} />
                ) : (
                  <Card className="py-8 text-center text-xs text-ink-soft">
                    섬길 친구 정보를 불러올 수 없습니다.
                  </Card>
                )}

                {/* 나를 섬기는 비밀 마니또 힌트 카드 */}
                {data.manito ? (
                  <ManitoCard
                    manito={data.manito}
                    joker={data.joker}
                    onOpenJokerModal={handleOpenJoker}
                  />
                ) : (
                  <Card className="py-8 text-center text-xs text-ink-soft">
                    비밀 마니또 힌트 정보를 불러올 수 없습니다.
                  </Card>
                )}

                {/* AI 스무고개 패널 */}
                <AskPanel ask={data.ask} onRefresh={refresh} />

                {/* 조커 모달 */}
                <JokerModal
                  isOpen={isJokerModalVisible}
                  onClose={handleCloseJoker}
                  joker={data.joker}
                  refresh={refresh}
                />
              </div>
            )}

            {/* Tab 2: 미션 */}
            {activeTab === "missions" && (
              <MissionList
                missions={data.missions}
                target={data.target}
                clockOffsetMs={clockOffsetMs}
                refresh={refresh}
              />
            )}

            {/* Tab 3: 우편함 */}
            {activeTab === "mailbox" && (
              <>
                {data.mailbox ? (
                  <MailboxPanel
                    mailbox={data.mailbox}
                    targetName={data.target?.name ?? "타깃"}
                    refresh={refresh}
                  />
                ) : (
                  <Card className="py-8 text-center text-xs text-ink-soft">
                    우편함 정보를 불러올 수 없습니다.
                  </Card>
                )}
              </>
            )}

            {/* Tab 4: 거짓·진실 게임 */}
            {activeTab === "truthLie" && (
              <TruthLiePanel
                truthLie={data.truthLie}
                myLieTurn={data.me.lieTurn}
                clockOffsetMs={clockOffsetMs}
                refresh={refresh}
              />
            )}

            {/* Tab 5: 배팅 */}
            {activeTab === "bet" && (
              <>
                {data.bet ? (
                  <BetPanel bet={data.bet} refresh={refresh} />
                ) : (
                  <Card className="py-8 text-center text-xs text-ink-soft">
                    배팅 정보를 불러올 수 없습니다.
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* View Mode 3: FINISHED (엔딩 뷰) */}
        {sessionStatus === "FINISHED" && (
          <>
            {data.ending ? (
              <EndingView ending={data.ending} myId={data.me.id} />
            ) : (
              <Card className="py-8 text-center text-xs text-ink-soft">
                엔딩 데이터를 집계 중입니다. 잠시만 기다려주세요!
              </Card>
            )}
          </>
        )}
      </div>

      {/* Bottom Fixed Tab Bar (Only in ACTIVE / GUESSING) */}
      {isDashboardMode && (
        <nav
          aria-label="하단 탭 메뉴"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-md items-center justify-around px-1 py-1.5">
            {/* 1. 마니또 탭 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("target");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl py-1 text-xs font-semibold transition active:scale-95 ${
                activeTab === "target"
                  ? "text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                🎁
              </span>
              <span className="text-[11px] leading-tight">마니또</span>
            </button>

            {/* 2. 미션 탭 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("missions");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`relative flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl py-1 text-xs font-semibold transition active:scale-95 ${
                activeTab === "missions"
                  ? "text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                📜
              </span>
              <span className="text-[11px] leading-tight">미션</span>
              {data.missions.some((m) => m.isActive) && (
                <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-brand" />
              )}
            </button>

            {/* 3. 우편함 탭 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("mailbox");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`relative flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl py-1 text-xs font-semibold transition active:scale-95 ${
                activeTab === "mailbox"
                  ? "text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                💌
              </span>
              <span className="text-[11px] leading-tight">우편함</span>
              {data.mailbox && data.mailbox.unansweredCount > 0 && (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white leading-none">
                  {data.mailbox.unansweredCount}
                </span>
              )}
            </button>

            {/* 4. 거짓·진실 탭 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("truthLie");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`relative flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl py-1 text-xs font-semibold transition active:scale-95 ${
                activeTab === "truthLie"
                  ? "text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                ⏱️
              </span>
              <span className="text-[11px] leading-tight">거짓·진실</span>
              {(data.truthLie.timer.status === "RUNNING" || data.truthLie.timer.status === "PAUSED") && (
                <span className="absolute right-2 top-1.5 h-2 w-2 animate-ping rounded-full bg-warn" />
              )}
            </button>

            {/* 5. 배팅 탭 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("bet");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center rounded-xl py-1 text-xs font-semibold transition active:scale-95 ${
                activeTab === "bet"
                  ? "text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                🎲
              </span>
              <span className="text-[11px] leading-tight">배팅</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
