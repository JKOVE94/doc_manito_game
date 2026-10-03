"use client";

import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, ErrorText, formatClock } from "@/components/ui";

interface Props {
  enabled: boolean;
  nextAt: string | null;
  sessionActive: boolean;
  clockOffsetMs: number;
  onRefresh: () => Promise<void>;
}

/** 미션 랜덤 자동 오픈 제어: 켜기/끄기, 다음 오픈까지 카운트다운, 지금 열기 */
export function MissionAutoControl({ enabled, nextAt, sessionActive, clockOffsetMs, onRefresh }: Props) {
  const [loading, setLoading] = useState<null | "toggle" | "now">(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!nextAt) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((Date.parse(nextAt) - (Date.now() + clockOffsetMs)) / 1000)));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [nextAt, clockOffsetMs]);

  const run = async (kind: "toggle" | "now", body: unknown) => {
    setLoading(kind);
    setError(null);
    try {
      await api("/api/admin/mission/auto", body);
      await onRefresh();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "요청에 실패했어요.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">🎲 미션 랜덤 자동 오픈</p>
        <Badge tone={enabled ? "accent" : "neutral"}>{enabled ? "켜짐" : "꺼짐"}</Badge>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft break-keep">
        게임 시작 5~15분 뒤 첫 미션이 열리고, 이후 약 30분(25~35분 랜덤)마다 다음 슬롯이 자동으로 열려요. 미션당 제한 30분.
      </p>
      {enabled && sessionActive && (
        <p className="text-sm text-ink">
          {nextAt && left !== null ? (
            <>
              다음 미션 오픈까지 <b className="font-mono text-brand">{formatClock(left)}</b>
            </>
          ) : (
            <span className="text-ink-soft">남은 미션이 없어요. (모든 슬롯이 열렸어요)</span>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={enabled ? "secondary" : "primary"}
          loading={loading === "toggle"}
          disabled={loading !== null}
          onClick={() => run("toggle", { enabled: !enabled })}
        >
          {enabled ? "자동 오픈 끄기" : "자동 오픈 켜기"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={loading === "now"}
          disabled={loading !== null || !sessionActive}
          onClick={() => run("now", { action: "open-next" })}
        >
          ▶ 다음 미션 지금 열기
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
