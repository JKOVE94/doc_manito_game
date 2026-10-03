"use client";

import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { remainingSeconds } from "@/lib/client/useLiveState";
import { RevealCountdown } from "@/components/RevealCountdown";
import { Badge, Button, Card, ErrorText, formatClock, Input, SectionTitle } from "@/components/ui";
import type { TimerStatus, TruthLieRevealRow, TimerView } from "@/lib/types";

interface TruthLieControllerProps {
  truthLie: {
    timer: TimerView;
    reveal: TruthLieRevealRow[];
  };
  clockOffsetMs: number;
  onRefresh: () => Promise<void>;
}

export function TruthLieController({
  truthLie,
  clockOffsetMs,
  onRefresh,
}: TruthLieControllerProps) {
  const { timer, reveal } = truthLie;
  const [durationMin, setDurationMin] = useState(15);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    remainingSeconds(timer, clockOffsetMs),
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 호스트 화면이 공유/투사될 수 있으므로 공개 전에는 기본으로 가림
  const [showTurns, setShowTurns] = useState(false);
  const turnsVisible = showTurns || timer.revealed;

  useEffect(() => {
    const timerId = setTimeout(() => {
      setSecondsLeft(remainingSeconds(timer, clockOffsetMs));
    }, 0);
    const interval = setInterval(() => {
      setSecondsLeft(remainingSeconds(timer, clockOffsetMs));
    }, 250);
    return () => {
      clearTimeout(timerId);
      clearInterval(interval);
    };
  }, [timer, clockOffsetMs]);

  const handleTimerAction = async (
    action: "start" | "pause" | "resume" | "end" | "reset" | "reveal" | "hide",
  ) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (action === "start") {
        await api("/api/admin/timer", {
          action: "start",
          durationSec: Math.max(1, durationMin) * 60,
        });
      } else {
        await api("/api/admin/timer", { action });
      }
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("타이머 요청에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getTimerStatusBadge = (status: TimerStatus) => {
    switch (status) {
      case "IDLE":
        return <Badge tone="neutral">대기 (IDLE)</Badge>;
      case "RUNNING":
        return <Badge tone="accent">진행 중 (RUNNING)</Badge>;
      case "PAUSED":
        return <Badge tone="warn">일시정지 (PAUSED)</Badge>;
      case "ENDED":
        return <Badge tone="danger">종료됨 (ENDED)</Badge>;
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle right={getTimerStatusBadge(timer.status)}>
        거짓·진실 게임 제어
      </SectionTitle>

      {/* Big Countdown Display */}
      <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-2 py-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          남은 시간
        </span>
        <span className="font-mono text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
          {formatClock(secondsLeft)}
        </span>
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
          <span>설정 시간: {Math.floor(timer.durationSec / 60)}분</span>
          <span>•</span>
          <span>
            순번 공개 상태:{" "}
            {timer.revealed ? (
              <strong className="text-brand">공개 중</strong>
            ) : (
              <strong className="text-ink-soft">비공개</strong>
            )}
          </span>
        </div>
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      {/* Timer Controls */}
      <div className="flex flex-col gap-2">
        {timer.status === "IDLE" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-xs font-semibold text-ink-soft">시간(분):</span>
              <Input
                type="number"
                min={1}
                max={120}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center font-bold"
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={() => handleTimerAction("start")}
              className="flex-1"
            >
              타이머 시작 ▶
            </Button>
          </div>
        )}

        {timer.status === "RUNNING" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={loading}
              onClick={() => handleTimerAction("pause")}
            >
              일시정지 ⏸
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={loading}
              onClick={() => handleTimerAction("end")}
            >
              즉시 종료 ⏹
            </Button>
          </div>
        )}

        {timer.status === "PAUSED" && (
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={() => handleTimerAction("resume")}
            >
              재개 ▶
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={loading}
              onClick={() => handleTimerAction("end")}
            >
              종료 ⏹
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={loading}
              onClick={() => handleTimerAction("reset")}
            >
              리셋 ↺
            </Button>
          </div>
        )}

        {timer.status === "ENDED" && (
          <Button
            type="button"
            variant="secondary"
            loading={loading}
            onClick={() => handleTimerAction("reset")}
            className="w-full"
          >
            타이머 리셋 ↺
          </Button>
        )}
      </div>

      {/* Reveal Toggle */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line p-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink">거짓말 순번 공개</span>
          <span className="text-xs text-ink-soft">
            {timer.revealed ? (
              "참가자 대시보드에 순번이 공개되어 있습니다."
            ) : timer.revealAt ? (
              <>
                종료 후 자동 공개까지 <RevealCountdown revealAt={timer.revealAt} clockOffsetMs={clockOffsetMs} /> (바로 공개하려면 버튼)
              </>
            ) : (
              "참가자에게 순번이 숨겨져 있습니다."
            )}
          </span>
        </div>
        <Button
          type="button"
          variant={timer.revealed ? "secondary" : "primary"}
          loading={loading}
          onClick={() => handleTimerAction(timer.revealed ? "hide" : "reveal")}
          className="min-h-10 text-xs px-3"
        >
          {timer.revealed ? "순번 다시 가리기 🙈" : "전원 거짓말 순번 공개 📢"}
        </Button>
      </div>

      {/* Reveal Table */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-ink-soft uppercase">
            참가자 거짓말 순번 현황 ({reveal.length}명)
          </h3>
          {!timer.revealed && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowTurns((v) => !v)}
              className="min-h-9 px-2 text-xs"
            >
              {showTurns ? "가리기 🙈" : "순번 보기 👁"}
            </Button>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-line divide-y divide-line">
          {reveal.length === 0 ? (
            <p className="p-3 text-center text-xs text-ink-soft">등록된 참가자가 없습니다.</p>
          ) : (
            reveal.map((r) => (
              <div
                key={r.participantId}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <span className="font-semibold text-ink">{r.name}</span>
                {r.lieTurn !== null && !turnsVisible ? (
                  <span className="text-ink-soft">입력 완료 ●</span>
                ) : r.lieTurn !== null ? (
                  <span className="font-bold text-brand">
                    #{r.lieTurn}번째 문장이 거짓
                  </span>
                ) : (
                  <span className="text-ink-soft">미입력</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
