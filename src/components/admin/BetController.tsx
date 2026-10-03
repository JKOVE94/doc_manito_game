"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { AdminBetRow, BetStatus, Faction } from "@/lib/types";

interface BetControllerProps {
  bets: {
    status: BetStatus;
    winningFaction: Faction | null;
    rows: AdminBetRow[];
  };
  onRefresh: () => Promise<void>;
}

export function BetController({ bets, onRefresh }: BetControllerProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<Faction>("LIBERAL");
  const [confirmAnnounce, setConfirmAnnounce] = useState(false);

  const getStatusBadge = (status: BetStatus) => {
    switch (status) {
      case "OPEN":
        return <Badge tone="accent">배팅 열림 (OPEN)</Badge>;
      case "LOCKED":
        return <Badge tone="warn">배팅 잠김 (LOCKED)</Badge>;
      case "RESULT":
        return <Badge tone="brand">결과 발표 (RESULT)</Badge>;
    }
  };

  const handleAction = async (action: "open" | "lock") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/bet", { action });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("배팅 상태 변경에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResult = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/bet", {
        action: "result",
        winningFaction: selectedFaction,
      });
      setConfirmAnnounce(false);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("결과 발표 처리에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <a href="/rules" target="_blank" rel="noopener" className="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3 text-xs font-semibold text-ink-soft hover:text-ink">📖 룰북</a>
            {getStatusBadge(bets.status)}
          </div>
        }
      >
        시크릿 히틀러 배팅 제어
      </SectionTitle>

      <ErrorText>{errorMsg}</ErrorText>

      {/* State Controls */}
      <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">배팅 상태 제어</span>
          <div className="flex items-center gap-2">
            {bets.status === "OPEN" && (
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                onClick={() => handleAction("lock")}
                className="min-h-9 px-3 py-1 text-xs"
              >
                배팅 마감 (잠금) 🔒
              </Button>
            )}
            {bets.status === "LOCKED" && (
              <Button
                type="button"
                variant="primary"
                loading={loading}
                onClick={() => handleAction("open")}
                className="min-h-9 px-3 py-1 text-xs"
              >
                배팅 다시 열기 🔓
              </Button>
            )}
            {bets.status === "RESULT" && (
              <Button
                type="button"
                variant="ghost"
                loading={loading}
                onClick={() => handleAction("open")}
                className="min-h-9 px-3 py-1 text-xs text-ink-soft"
              >
                배팅 다시 열기 ↺
              </Button>
            )}
          </div>
        </div>

        {/* Announce Result Controls */}
        {bets.status === "LOCKED" && (
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <span className="text-xs font-semibold text-ink-soft">
              승리 진영 선택 후 결과 발표:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFaction("LIBERAL")}
                className={`flex min-h-11 items-center justify-center rounded-xl border p-2 text-xs font-bold transition ${
                  selectedFaction === "LIBERAL"
                    ? "border-accent bg-accent/15 text-accent shadow-sm"
                    : "border-line bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                자유주의 (LIBERAL)
              </button>
              <button
                type="button"
                onClick={() => setSelectedFaction("FASCIST")}
                className={`flex min-h-11 items-center justify-center rounded-xl border p-2 text-xs font-bold transition ${
                  selectedFaction === "FASCIST"
                    ? "border-brand bg-brand/15 text-brand shadow-sm"
                    : "border-line bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                파시스트 (FASCIST)
              </button>
            </div>

            {confirmAnnounce ? (
              <div className="mt-1 flex flex-col gap-2 rounded-xl border border-brand/40 bg-surface p-2.5">
                <p className="text-xs font-medium text-ink">
                  승리 진영을{" "}
                  <strong className="text-brand">
                    {selectedFaction === "LIBERAL" ? "자유주의" : "파시스트"}
                  </strong>
                  (으)로 발표하시겠습니까? 참가자들의 적중 여부가 확정됩니다.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    loading={loading}
                    onClick={handleResult}
                    className="min-h-9 flex-1 text-xs"
                  >
                    발표 확정 📢
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => setConfirmAnnounce(false)}
                    className="min-h-9 flex-1 text-xs"
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
                onClick={() => setConfirmAnnounce(true)}
                className="w-full text-xs"
              >
                {selectedFaction === "LIBERAL" ? "자유주의" : "파시스트"} 승리 결과 발표 📢
              </Button>
            )}
          </div>
        )}

        {bets.status === "RESULT" && bets.winningFaction && (
          <div className="flex items-center justify-between rounded-xl bg-surface p-3 text-xs border border-line">
            <span className="text-ink-soft">최종 승리 진영:</span>
            <Badge tone={bets.winningFaction === "LIBERAL" ? "accent" : "brand"}>
              {bets.winningFaction === "LIBERAL"
                ? "자유주의 (LIBERAL)"
                : "파시스트 (FASCIST)"}
            </Badge>
          </div>
        )}
      </div>

      {/* Bets Rows List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
          <span>참가자 배팅 목록 ({bets.rows.length}명)</span>
        </div>

        {bets.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            제출된 배팅 내역이 없습니다.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[360px] text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-2 font-semibold text-ink-soft">
                  <th className="px-3 py-2.5">이름</th>
                  <th className="px-3 py-2.5">선택 진영</th>
                  <th className="px-3 py-2.5">예측</th>
                  <th className="px-3 py-2.5 text-right">적중 여부</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bets.rows.map((row) => (
                  <tr key={row.participant.id} className="hover:bg-surface-2/40">
                    <td className="px-3 py-2.5 font-semibold text-ink">
                      {row.participant.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={row.faction === "LIBERAL" ? "accent" : "brand"}>
                        {row.faction === "LIBERAL" ? "자유주의" : "파시스트"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-ink">
                      {row.prediction === "WIN" ? "승리" : "패배"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {bets.status === "RESULT" ? (
                        row.correct === true ? (
                          <span className="text-accent font-bold">적중 🎯</span>
                        ) : (
                          <span className="text-danger font-bold">불발 ❌</span>
                        )
                      ) : (
                        <span className="text-ink-soft">대기 중</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
