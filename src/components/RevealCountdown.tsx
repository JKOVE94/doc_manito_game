"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/ui";

/** 거짓말 순번 자동 공개까지 남은 시간 mm:ss (서버 시각 오프셋 보정, 1초 갱신) */
export function RevealCountdown({ revealAt, clockOffsetMs }: { revealAt: string; clockOffsetMs: number }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const target = Date.parse(revealAt);
    const tick = () => setLeft(Math.max(0, Math.ceil((target - (Date.now() + clockOffsetMs)) / 1000)));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [revealAt, clockOffsetMs]);

  return <b className="font-mono text-brand">{left === null ? "--:--" : formatClock(left)}</b>;
}
