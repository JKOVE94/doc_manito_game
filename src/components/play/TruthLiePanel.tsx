"use client";

import { useEffect, useState } from "react";
import { Badge, Card, ErrorText, formatClock, SectionTitle } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import { remainingSeconds } from "@/lib/client/useLiveState";
import { RevealCountdown } from "@/components/RevealCountdown";
import type { ParticipantState } from "@/lib/types";

interface TruthLiePanelProps {
  truthLie: ParticipantState["truthLie"];
  myLieTurn: number | null;
  clockOffsetMs: number;
  refresh: () => Promise<void>;
}

export function TruthLiePanel({
  truthLie,
  myLieTurn,
  clockOffsetMs,
  refresh,
}: TruthLiePanelProps) {
  const { timer, reveal } = truthLie;
  const isIdle = timer.status === "IDLE";
  const isRunning = timer.status === "RUNNING";
  const isPaused = timer.status === "PAUSED";
  const isEnded = timer.status === "ENDED";

  // Lie turn visibility toggle
  const [showTurn, setShowTurn] = useState(false);
  const [savingLieTurn, setSavingLieTurn] = useState(false);
  const [lieTurnError, setLieTurnError] = useState<string | null>(null);

  // Timer tick for active countdown
  const [, setTicks] = useState(0);

  useEffect(() => {
    if (!isRunning && !isPaused) return;

    const interval = setInterval(() => {
      setTicks((t) => t + 1);
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  const remainingSec = remainingSeconds(timer, clockOffsetMs);

  const handleChangeLieTurn = async (turn: 1 | 2 | 3 | 4) => {
    if (!isIdle || myLieTurn === turn) return;

    setSavingLieTurn(true);
    setLieTurnError(null);
    try {
      await api("/api/me/lie-turn", { lieTurn: turn });
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setLieTurnError(err.message);
      } else {
        setLieTurnError("거짓말 순번 저장에 실패했습니다.");
      }
    } finally {
      setSavingLieTurn(false);
    }
  };

  // SVG Circular countdown calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const totalDuration = timer.durationSec > 0 ? timer.durationSec : 60;
  const progressRatio = Math.min(1, Math.max(0, remainingSec / totalDuration));
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 내 거짓말 순번 비밀 카드 */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>🤫 내 거짓말 순번</SectionTitle>
          <button
            type="button"
            onClick={() => setShowTurn((prev) => !prev)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft transition hover:text-ink"
          >
            {showTurn ? "🙈 가림" : "👁️ 보기"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-xs text-ink-soft">비밀 선택값:</span>
          <span className="text-base font-bold text-brand">
            {myLieTurn !== null
              ? showTurn
                ? `${myLieTurn}번 발언에서 거짓말!`
                : "비밀 (●번)"
              : "미설정"}
          </span>
        </div>

        {/* Change buttons */}
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">
              {isIdle
                ? "순번 변경 가능 (타이머 시작 전)"
                : "🔒 게임 진행 중에는 변경 불가"}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as const).map((turn) => {
              const isSelected = myLieTurn === turn;
              return (
                <button
                  key={turn}
                  type="button"
                  onClick={() => handleChangeLieTurn(turn)}
                  disabled={!isIdle || savingLieTurn}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-xl border text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed ${
                    isSelected
                      ? "border-brand bg-brand text-brand-ink shadow-xs"
                      : "border-line bg-surface text-ink hover:border-brand/40"
                  } ${!isIdle ? "opacity-60" : ""}`}
                >
                  <span>
                    {showTurn ? `${turn}번` : isSelected ? "●" : `${turn}번`}
                  </span>
                </button>
              );
            })}
          </div>

          <ErrorText>{lieTurnError}</ErrorText>
        </div>
      </Card>

      {/* 2. 대형 원형 카운트다운 타이머 */}
      <Card className="flex flex-col items-center py-6 text-center">
        <div className="mb-2 flex items-center gap-1.5">
          {isRunning && <Badge tone="brand">진행 중 ⏱️</Badge>}
          {isPaused && <Badge tone="warn">일시정지 ⏸️</Badge>}
          {isEnded && <Badge tone="neutral">종료됨 🔔</Badge>}
          {isIdle && <Badge tone="neutral">준비 대기 ⏳</Badge>}
        </div>

        {/* Circular SVG Timer */}
        <div className="relative my-3 flex items-center justify-center">
          <svg
            className="h-44 w-44 -rotate-90 transform"
            viewBox="0 0 160 160"
            aria-hidden="true"
          >
            {/* Background track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-line/60"
            />
            {/* Progress track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-300 ${
                isPaused
                  ? "text-warn"
                  : isEnded
                    ? "text-ink-soft/40"
                    : remainingSec <= 10
                      ? "text-danger"
                      : "text-brand"
              }`}
            />
          </svg>

          {/* Center text inside SVG */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-mono text-3xl font-black tracking-wider ${
                remainingSec <= 10 && isRunning ? "text-danger animate-pulse" : "text-ink"
              }`}
            >
              {formatClock(remainingSec)}
            </span>
            <span className="mt-1 text-xs font-semibold text-ink-soft">
              {isRunning
                ? "남은 발언 시간"
                : isPaused
                  ? "타이머 정지됨"
                  : isEnded
                    ? "타이머 종료"
                    : "대기 중"}
            </span>
          </div>
        </div>

        <p className="mt-1 text-xs text-ink-soft">
          {isRunning
            ? "시간 내에 4가지 이야기 중 1가지 거짓말을 섞어 말해주세요!"
            : isPaused
              ? "호스트가 타이머를 일시정지했습니다."
              : isEnded
                ? "발언 시간이 모두 종료되었습니다."
                : "호스트가 타이머를 시작하면 카운트다운이 시작됩니다."}
        </p>

        {isEnded && !timer.revealed && timer.revealAt && (
          <div className="mt-3 rounded-xl border border-brand/30 bg-brand/10 p-3 text-center text-sm">
            🤔 누가 몇 번째에 거짓말을 했을까요?
            <br />
            <span className="text-ink-soft">
              거짓말 순번은 <RevealCountdown revealAt={timer.revealAt} clockOffsetMs={clockOffsetMs} /> 뒤에 공개돼요. 그 전에 마지막으로 추리해 보세요!
            </span>
          </div>
        )}
      </Card>

      {/* 3. 거짓말 순번 공개 (reveal) */}
      {reveal && reveal.length > 0 && (
        <Card className="border-accent/40 bg-linear-to-b from-accent/5 to-surface shadow-sm">
          <div className="mb-2">
            <SectionTitle
              right={<Badge tone="accent">결과 공개 완료</Badge>}
            >
              🎉 거짓말 순번 공개!
            </SectionTitle>
            <p className="text-xs text-ink-soft">
              각 참가자가 몇 번째 발언에서 거짓말을 설정했는지 확인하세요!
            </p>
          </div>

          <div className="mt-3 flex flex-col divide-y divide-line/60">
            {reveal.map((row, idx) => (
              <div
                key={row.participantId}
                className="flex items-center justify-between py-2.5 transition-all duration-300"
                style={{
                  animation: "fadeIn 0.4s ease-out forwards",
                  animationDelay: `${idx * 80}ms`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink-soft">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-bold text-ink">
                    {row.name}
                  </span>
                </div>

                {/* 1~4 chips */}
                {row.lieTurn !== null ? (
                  <div className="flex items-center gap-1.5">
                    {([1, 2, 3, 4] as const).map((turn) => {
                      const isLie = row.lieTurn === turn;
                      return (
                        <span
                          key={turn}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${
                            isLie
                              ? "bg-brand text-brand-ink ring-2 ring-brand/30 shadow-xs scale-105"
                              : "bg-surface-2 text-ink-soft/60"
                          }`}
                        >
                          {turn}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs text-ink-soft">미입력</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
