"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "./api";
import { getBrowserSupabase } from "./supabase-browser";

const POLL_MS = 5000;

/**
 * 서버 상태를 실시간으로 유지하는 훅.
 * - Supabase Realtime 으로 game_sessions 변경 신호를 받으면 즉시 재조회
 * - 신호 누락 대비 5초 폴링
 * - clockOffsetMs: (서버시각 - 로컬시각). 타이머 표시 시 Date.now() + clockOffsetMs 사용
 */
export function useLiveState<T extends { serverNow: string }>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const sentAt = Date.now();
    try {
      const next = await api<T>(path);
      const receivedAt = Date.now();
      setClockOffsetMs(new Date(next.serverNow).getTime() - (sentAt + receivedAt) / 2);
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e : new ApiRequestError("네트워크 오류", 0));
    } finally {
      inflight.current = false;
    }
  }, [path]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);

    const supabase = getBrowserSupabase();
    const channel = supabase
      ?.channel(`session-signal-${path}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [path, refresh]);

  return { data, error, refresh, clockOffsetMs };
}

/** 타이머 남은 초 계산 (TimerView + clockOffsetMs) */
export function remainingSeconds(
  timer: { status: string; endsAt: string | null; remainingSec: number },
  clockOffsetMs: number,
): number {
  if (timer.status === "RUNNING" && timer.endsAt) {
    const ms = new Date(timer.endsAt).getTime() - (Date.now() + clockOffsetMs);
    return Math.max(0, Math.ceil(ms / 1000));
  }
  return timer.status === "ENDED" ? 0 : timer.remainingSec;
}
