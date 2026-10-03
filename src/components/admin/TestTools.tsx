"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Input, SectionTitle } from "@/components/ui";
import type { AdminParticipantRow, AdminState, BotActResult } from "@/lib/types";

interface TestToolsProps {
  session: AdminState["session"];
  participants: AdminParticipantRow[];
  botCount: number;
  onRefresh: () => Promise<void> | void;
}

export function TestTools({
  session,
  participants,
  botCount,
  onRefresh,
}: TestToolsProps) {
  const realCount = participants.filter((p) => !p.isBot).length;
  const recommendedCount = Math.max(1, Math.min(10, session.minParticipants - realCount));

  const [userCount, setUserCount] = useState<number | null>(null);
  const addCount = userCount ?? recommendedCount;

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actSummary, setActSummary] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // 1. 봇 추가
  const handleAddBots = async () => {
    if (session.status !== "READY") return;
    const count = Number(addCount);
    if (isNaN(count) || count < 1 || count > 10) {
      setErrorMsg("봇 수는 1명에서 10명 사이여야 합니다.");
      return;
    }

    setLoadingAction("add");
    setErrorMsg(null);
    setActSummary(null);
    try {
      await api("/api/admin/test/bots", { action: "add", count });
      setUserCount(null);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("봇 추가 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. 봇 전체 삭제
  const handleRemoveBots = async () => {
    if (session.status !== "READY" || botCount <= 0) return;
    setLoadingAction("remove");
    setErrorMsg(null);
    setActSummary(null);
    try {
      await api("/api/admin/test/bots", { action: "remove" });
      setConfirmRemove(false);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("봇 삭제 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. 봇 자동 행동
  const handleActBots = async () => {
    const isActionPhase = session.status === "ACTIVE" || session.status === "GUESSING";
    if (!isActionPhase || botCount <= 0) return;

    setLoadingAction("act");
    setErrorMsg(null);
    setActSummary(null);
    try {
      const res = await api<BotActResult>("/api/admin/test/act", {});
      setActSummary(res.summary);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("봇 자동 행동 실행 중 오류가 발생했습니다.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. 봇으로 보기 (사칭 로그인)
  const handleImpersonate = async (participantId: string) => {
    setLoadingAction(`impersonate-${participantId}`);
    setErrorMsg(null);
    try {
      await api("/api/admin/test/impersonate", { participantId });
      window.open("/play", "_blank");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("봇으로 전환 요청 중 오류가 발생했습니다.");
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const isReady = session.status === "READY";
  const isActionPhase = session.status === "ACTIVE" || session.status === "GUESSING";
  const botParticipants = participants.filter((p) => p.isBot);

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <SectionTitle
          right={
            botCount > 0 ? (
              <Badge tone="warn">봇 {botCount}명 활성</Badge>
            ) : (
              <Badge tone="neutral">봇 없음</Badge>
            )
          }
        >
          🧪 테스트 도구
        </SectionTitle>
        <p className="text-xs text-ink-soft sm:text-sm">
          봇 참가자로 혼자 리허설하기. 실제 파티 전 RESET 하면 봇은 자동 삭제돼요.
        </p>
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      {/* 봇 추가 & 삭제 (READY 일 때) */}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">봇 관리</span>
          {!isReady && (
            <span className="text-xs text-ink-soft">
              (대기 중인 READY 상태에서만 봇을 추가/삭제할 수 있어요)
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-24">
              <Input
                type="number"
                min={1}
                max={10}
                value={addCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setUserCount(isNaN(val) ? 1 : Math.max(1, Math.min(10, val)));
                }}
                disabled={!isReady || loadingAction !== null}
                className="h-11 text-center font-bold"
                aria-label="추가할 봇 수"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              loading={loadingAction === "add"}
              disabled={!isReady || loadingAction !== null}
              onClick={handleAddBots}
              className="flex-1 min-w-[140px]"
            >
              🤖 봇 {addCount}명 추가
            </Button>
          </div>

          {/* 봇 전체 삭제 버튼 및 2단계 확인 */}
          {botCount > 0 && isReady && (
            <div className="pt-2 border-t border-line/60">
              {confirmRemove ? (
                <div className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3">
                  <p className="text-xs font-semibold text-danger">
                    정말 봇 {botCount}명을 모두 삭제하시겠습니까?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      loading={loadingAction === "remove"}
                      disabled={loadingAction !== null}
                      onClick={handleRemoveBots}
                      className="flex-1 text-xs"
                    >
                      삭제 확인
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loadingAction !== null}
                      onClick={() => setConfirmRemove(false)}
                      className="flex-1 text-xs"
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={loadingAction !== null}
                    onClick={() => setConfirmRemove(true)}
                    className="min-h-9 px-3 text-xs text-danger hover:bg-danger/10"
                  >
                    🗑️ 봇 전체 삭제 ({botCount}명)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 봇 자동 행동 (ACTIVE 또는 GUESSING 일 때) */}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">봇 자동 행동</span>
          <Badge tone={isActionPhase && botCount > 0 ? "brand" : "neutral"}>
            {session.status}
          </Badge>
        </div>

        <p className="mb-3 text-xs leading-relaxed text-ink-soft">
          진행 중 미션 제출 · 배팅(열려 있을 때) · 최종 추리(추리 단계일 때)를 봇 전원이 수행해요.
          미션 승인은 &apos;미션 제출 검토&apos;에서 직접 하세요.
        </p>

        {actSummary && (
          <div className="mb-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent">
            ✨ 실행 결과: {actSummary}
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          loading={loadingAction === "act"}
          disabled={!isActionPhase || botCount <= 0 || loadingAction !== null}
          onClick={handleActBots}
          className="w-full"
        >
          ▶ 봇 자동 행동 실행
        </Button>
      </div>

      {/* 봇으로 보기 */}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-1">
          <span className="text-sm font-bold text-ink">봇으로 보기</span>
        </div>
        <p className="mb-3 text-xs text-ink-soft">
          같은 브라우저의 참가자 로그인이 이 봇으로 바뀌어요. 내 참가자 화면은 다른 브라우저/시크릿 창에서 여세요.
        </p>

        {botParticipants.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-soft">
            현재 등록된 봇 참가자가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line/60 rounded-xl border border-line bg-surface">
            {botParticipants.map((bot) => (
              <div
                key={bot.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge tone="warn">봇</Badge>
                  <span className="truncate font-semibold text-sm text-ink">
                    {bot.name}
                  </span>
                  {bot.alias && (
                    <span className="truncate text-xs text-ink-soft">
                      ({bot.alias})
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  loading={loadingAction === `impersonate-${bot.id}`}
                  disabled={loadingAction !== null}
                  onClick={() => handleImpersonate(bot.id)}
                  className="min-h-9 px-3 text-xs font-semibold text-brand hover:bg-brand/10"
                >
                  👁️ 봇으로 보기
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
