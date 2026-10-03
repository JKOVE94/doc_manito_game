"use client";

import { useEffect, useState } from "react";
import { Button, cx, ErrorText, formatClock } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";

export interface AwayControlProps {
  awaySince: string | null;
  clockOffsetMs: number;
  refresh: () => Promise<void>;
  confirming?: boolean;
  onCloseConfirm?: () => void;
  className?: string;
  slot?: "auto" | "button" | "banner";
}

/**
 * 🚶 자리비움 UI 컨트롤
 * - 자리에 있을 때: 인라인 확인 ("잠시 자리를 비우나요? 비운 시간만큼 미션 마감이 연장돼요") -> away: true
 * - 자리비움 중: 전체 폭 warn 톤 배너 ("🚶 자리비움 중 · {경과 mm:ss} — 미션 마감이 연장되고 퀴즈는 쉬어요") + 큰 복귀 버튼 -> away: false
 */
export function AwayControl({
  awaySince,
  clockOffsetMs,
  refresh,
  confirming = false,
  onCloseConfirm,
  className,
  slot = "auto",
}: AwayControlProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1초마다 현재 시각 갱신하여 경과 시간 계산
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    if (!awaySince) return;
    const timer = setInterval(() => {
      setNow(Date.now() + clockOffsetMs);
    }, 1000);
    return () => clearInterval(timer);
  }, [awaySince, clockOffsetMs]);

  // 자리비움 시작 확인
  const handleConfirmAway = async () => {
    setLoading(true);
    setError(null);
    try {
      await api("/api/me/away", { away: true });
      if (onCloseConfirm) {
        onCloseConfirm();
      }
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("자리비움 설정에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 복귀 완료
  const handleReturn = async () => {
    setLoading(true);
    setError(null);
    try {
      await api("/api/me/away", { away: false });
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("복귀 처리에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. 자리비움 중 (warn 톤 전체 폭 배너)
  if (awaySince) {
    if (slot === "button") return null;

    const startedAt = new Date(awaySince).getTime();
    const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    const elapsedFormatted = formatClock(elapsedSec);

    return (
      <aside
        aria-label="자리비움 상태 배너"
        className={cx(
          "flex flex-col gap-3 rounded-2xl border border-warn/40 bg-warn/15 p-4 text-ink shadow-xs",
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="text-xl shrink-0" aria-hidden="true">
            🚶
          </span>
          <div className="flex flex-1 flex-col min-w-0">
            <p className="text-sm font-semibold text-ink leading-snug break-words">
              🚶 자리비움 중 · <span className="font-mono font-bold">{elapsedFormatted}</span> — 미션 마감이 연장되고 퀴즈는 쉬어요
            </p>
          </div>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <Button
          type="button"
          variant="primary"
          loading={loading}
          disabled={loading}
          onClick={handleReturn}
          className="w-full !min-h-12 text-base font-bold !bg-warn !text-ink hover:brightness-105"
        >
          ✋ 복귀했어요
        </Button>
      </aside>
    );
  }

  // 2. 자리에 있을 때: 인라인 확인 열림 상태
  if (confirming) {
    if (slot === "button") return null;

    return (
      <div
        role="alert"
        aria-label="자리비움 확인 안내"
        className={cx(
          "flex flex-col gap-2.5 rounded-2xl border border-warn/40 bg-warn/10 p-3.5 text-xs text-ink shadow-xs",
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0" aria-hidden="true">
            🚶
          </span>
          <p className="font-medium text-ink leading-relaxed break-words">
            잠시 자리를 비우나요? 비운 시간만큼 미션 마감이 연장돼요
          </p>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <div className="flex items-center justify-end gap-2 pt-0.5">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setError(null);
              if (onCloseConfirm) onCloseConfirm();
            }}
            className="!min-h-8 !px-3 text-xs text-ink-soft hover:text-ink"
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={loading}
            onClick={handleConfirmAway}
            className="!min-h-8 !px-3 text-xs !bg-warn !text-ink font-bold hover:brightness-105"
          >
            자리비움 확인
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * 헤더용 작은 자리비움 버튼
 */
export function AwayButton({
  onClick,
  className,
  active,
}: {
  onClick?: () => void;
  className?: string;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onClick}
      className={cx(
        "!min-h-9 !px-2.5 text-xs text-ink transition-colors",
        active && "border-warn/60 bg-warn/15",
        className,
      )}
    >
      🚶 자리비움
    </Button>
  );
}

AwayControl.Button = AwayButton;
