"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { SessionStatus } from "@/lib/types";

interface SessionControlProps {
  session: {
    status: SessionStatus;
    startedAt: string | null;
    minParticipants: number;
    canStart: boolean;
  };
  participantsCount: number;
  botCount?: number;
  onRefresh: () => Promise<void>;
}

export function SessionControl({
  session,
  participantsCount,
  botCount = 0,
  onRefresh,
}: SessionControlProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [conflictMissing, setConflictMissing] = useState<string[] | null>(null);
  const [confirmAction, setConfirmAction] = useState<"guessing" | "finish" | "back-to-active" | null>(null);

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case "READY":
        return <Badge tone="neutral">대기 중 (READY)</Badge>;
      case "ACTIVE":
        return <Badge tone="brand">진행 중 (ACTIVE)</Badge>;
      case "GUESSING":
        return <Badge tone="warn">최종 추리 (GUESSING)</Badge>;
      case "FINISHED":
        return <Badge tone="accent">게임 종료 (FINISHED)</Badge>;
    }
  };

  const handleStart = async (force = false) => {
    setLoading(true);
    setErrorMsg(null);
    setConflictMissing(null);
    try {
      await api("/api/admin/session", { action: "start", force });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        if (err.status === 409) {
          // If 409, allow force start
          setConflictMissing([]);
        }
      } else {
        setErrorMsg("세션 시작 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseTransition = async (action: "guessing" | "finish" | "back-to-active") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/session", { action });
      setConfirmAction(null);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("단계 변경 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      {botCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs sm:text-sm font-semibold text-warn">
          <span>🧪 테스트 모드: 봇 {botCount}명 포함 — 실제 파티 전 RESET 하세요</span>
        </div>
      )}

      <SectionTitle right={getStatusBadge(session.status)}>
        세션 진행 제어
      </SectionTitle>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">참가자 현황:</span>
          <span className="font-bold text-brand">{participantsCount}명</span>
          <span className="text-xs text-ink-soft">/ 최소 {session.minParticipants}명</span>
        </div>
        {session.startedAt && (
          <div className="text-xs text-ink-soft">
            시작 시각: {new Date(session.startedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        )}
      </div>

      {/* READY State Actions */}
      {session.status === "READY" && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={!session.canStart || loading}
            onClick={() => handleStart(false)}
            className="w-full"
          >
            마니또 셔플 & 게임 시작 🎲
          </Button>

          {!session.canStart && (
            <p className="text-center text-xs text-warn">
              {participantsCount < session.minParticipants
                ? `최소 ${session.minParticipants}명 이상 참가해야 시작할 수 있습니다. (현재 ${participantsCount}명)`
                : "시작 조건을 만족하지 못했습니다. 키워드 입력을 확인해주세요."}
            </p>
          )}

          {conflictMissing !== null && (
            <div className="flex flex-col gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3">
              <p className="text-xs font-semibold text-warn">
                경고: 아직 준비를 마치지 않은 참가자가 있습니다.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="danger"
                  loading={loading}
                  onClick={() => handleStart(true)}
                  className="flex-1 text-xs"
                >
                  그래도 시작 (강제)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setConflictMissing(null)}
                  className="flex-1 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE State Actions */}
      {session.status === "ACTIVE" && (
        <div className="flex flex-col gap-2">
          {confirmAction === "guessing" ? (
            <div className="flex flex-col gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3">
              <p className="text-xs font-semibold text-warn">
                최종 마니또 추리 단계를 오픈하시겠습니까? 미션 진행이 마감되고 참가자들에게 추리 입력창이 열립니다.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  onClick={() => handlePhaseTransition("guessing")}
                  className="flex-1 text-xs"
                >
                  오픈 확인
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              loading={loading}
              disabled={loading}
              onClick={() => setConfirmAction("guessing")}
              className="w-full"
            >
              최종 추리 오픈 🔍
            </Button>
          )}
        </div>
      )}

      {/* GUESSING State Actions */}
      {session.status === "GUESSING" && (
        <div className="flex flex-col gap-2">
          {confirmAction === "finish" ? (
            <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/10 p-3">
              <p className="text-xs font-semibold text-brand">
                마니또 게임을 종료하고 최종 결과를 전체 공개하시겠습니까?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  loading={loading}
                  onClick={() => handlePhaseTransition("finish")}
                  className="flex-1 text-xs"
                >
                  결과 공개 확인
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              loading={loading}
              disabled={loading}
              onClick={() => setConfirmAction("finish")}
              className="w-full"
            >
              결과 공개 (게임 종료) 🎉
            </Button>
          )}

          {confirmAction === "back-to-active" ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-xs font-medium text-ink">
                진행중(ACTIVE) 단계로 되돌리시겠습니까?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={loading}
                  onClick={() => handlePhaseTransition("back-to-active")}
                  className="flex-1 text-xs"
                >
                  되돌리기 확인
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              loading={loading}
              disabled={loading}
              onClick={() => setConfirmAction("back-to-active")}
              className="w-full text-xs"
            >
              진행중으로 되돌리기 ↩️
            </Button>
          )}
        </div>
      )}

      {/* FINISHED State Actions */}
      {session.status === "FINISHED" && (
        <div className="flex flex-col gap-2">
          {confirmAction === "back-to-active" ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-xs font-medium text-ink">
                게임 종료 상태를 풀고 다시 진행중(ACTIVE)으로 되돌리시겠습니까?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={loading}
                  onClick={() => handlePhaseTransition("back-to-active")}
                  className="flex-1 text-xs"
                >
                  되돌리기 확인
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 text-xs"
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              loading={loading}
              disabled={loading}
              onClick={() => setConfirmAction("back-to-active")}
              className="w-full text-xs"
            >
              진행중으로 되돌리기 ↩️
            </Button>
          )}
        </div>
      )}

      <ErrorText>{errorMsg}</ErrorText>
    </Card>
  );
}
