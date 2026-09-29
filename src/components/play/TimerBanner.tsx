"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/ui";
import { remainingSeconds } from "@/lib/client/useLiveState";
import type { TimerView } from "@/lib/types";

interface TimerBannerProps {
  timer: TimerView;
  clockOffsetMs: number;
  onNavigateToGame?: () => void;
}

export function TimerBanner({
  timer,
  clockOffsetMs,
  onNavigateToGame,
}: TimerBannerProps) {
  const isRunning = timer.status === "RUNNING";
  const isPaused = timer.status === "PAUSED";

  // Re-render tick every 250ms when timer is active
  const [, setTicks] = useState(0);

  useEffect(() => {
    if (!isRunning && !isPaused) return;

    const interval = setInterval(() => {
      setTicks((t) => t + 1);
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  if (!isRunning && !isPaused) {
    return null;
  }

  const remainingSec = remainingSeconds(timer, clockOffsetMs);

  return (
    <aside
      aria-label="거짓·진실 게임 타이머 배너"
      onClick={onNavigateToGame}
      className={`sticky top-0 z-30 flex w-full cursor-pointer items-center justify-between px-4 py-2.5 shadow-md transition active:opacity-90 ${
        isRunning
          ? "bg-brand text-brand-ink"
          : "bg-warn text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">
          {isRunning ? "⏱️" : "⏸️"}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-tight">
            {isRunning ? "거짓·진실 게임 진행 중" : "거짓·진실 타이머 일시정지"}
          </span>
          <span className="text-[11px] opacity-90">탭하여 게임 탭으로 이동</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xl font-bold tracking-wider">
          {formatClock(remainingSec)}
        </span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
          이동 →
        </span>
      </div>
    </aside>
  );
}
