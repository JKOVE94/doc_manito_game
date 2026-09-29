"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { AdminChainRow, SessionStatus } from "@/lib/types";

interface ChainBoardProps {
  chains: AdminChainRow[];
  sessionStatus: SessionStatus;
  onRefresh: () => Promise<void>;
}

export function ChainBoard({
  chains,
  sessionStatus,
  onRefresh,
}: ChainBoardProps) {
  const [showMatching, setShowMatching] = useState(false);
  const [loadingChainId, setLoadingChainId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUnlockLevel = async (chainId: string, newLevel: number) => {
    if (newLevel < 0 || newLevel > 3) return;
    setLoadingChainId(chainId);
    setErrorMsg(null);
    try {
      await api("/api/admin/chain/unlock", {
        chainId,
        level: newLevel,
      });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("해금 레벨 변경에 실패했습니다.");
      }
    } finally {
      setLoadingChainId(null);
    }
  };

  if (sessionStatus === "READY") {
    return (
      <Card className="flex flex-col gap-3">
        <SectionTitle>마니또 순환 매칭 고리</SectionTitle>
        <p className="py-6 text-center text-sm text-ink-soft">
          게임이 시작(ACTIVE)되면 전체 마니또 순환 고리가 배정됩니다.
        </p>
      </Card>
    );
  }

  // Position sort
  const sortedChains = [...chains].sort((a, b) => a.position - b.position);

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          <Button
            type="button"
            variant={showMatching ? "secondary" : "primary"}
            onClick={() => setShowMatching((prev) => !prev)}
            className="min-h-9 px-3 text-xs"
          >
            {showMatching ? "매칭 숨기기 🙈" : "매칭 보기 👁️"}
          </Button>
        }
      >
        마니또 순환 체인 (Chain Board)
      </SectionTitle>

      <ErrorText>{errorMsg}</ErrorText>

      {!showMatching ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2 p-6 text-center">
          <p className="text-sm font-semibold text-ink">
            🔒 스포일러 방지를 위해 가려져 있습니다
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            사회자가 진행 상황이나 해금 단계를 점검할 때만 &apos;매칭 보기&apos;를 눌러주세요.
          </p>
        </div>
      ) : sortedChains.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          등록된 매칭 체인이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedChains.map((c) => {
            const isLoading = loadingChainId === c.id;

            return (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-sm text-sm"
              >
                {/* Giver -> Receiver */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-brand">
                      #{c.position + 1}
                    </span>
                    <span className="font-bold text-ink">{c.giver.name}</span>
                    <span className="text-brand">➔</span>
                    <span className="font-bold text-accent">{c.receiver.name}</span>
                    <span className="text-xs text-ink-soft">
                      ({c.receiverAlias})
                    </span>
                  </div>

                  <div className="text-xs text-ink-soft">
                    승인 미션: <strong className="text-ink">{c.approvedMissions}개</strong>
                  </div>
                </div>

                {/* Level Controls & Stats */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  {/* Unlock level */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-soft">키워드 해금:</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={c.unlockedLevel <= 0 || isLoading}
                        onClick={() => handleUnlockLevel(c.id, c.unlockedLevel - 1)}
                        className="min-h-7 w-7 p-0 text-xs font-bold"
                      >
                        −
                      </Button>
                      <Badge tone={c.unlockedLevel === 3 ? "accent" : "brand"}>
                        Level {c.unlockedLevel} / 3
                      </Badge>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={c.unlockedLevel >= 3 || isLoading}
                        onClick={() => handleUnlockLevel(c.id, c.unlockedLevel + 1)}
                        className="min-h-7 w-7 p-0 text-xs font-bold"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Joker info */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink-soft">조커 찬스:</span>
                    {!c.hintUsed ? (
                      <span className="text-ink-soft">미사용</span>
                    ) : c.hintSolved === true ? (
                      <Badge tone="accent">정답 🎯</Badge>
                    ) : c.hintSolved === false ? (
                      <Badge tone="danger">오답 ❌</Badge>
                    ) : (
                      <Badge tone="warn">풀이 중 ⏳</Badge>
                    )}
                  </div>
                </div>

                {/* Final Guess Result */}
                <div className="flex items-center gap-2 text-xs pt-1 border-t border-line/40 text-ink-soft">
                  <span>최종 추리:</span>
                  {c.guess ? (
                    <span className="font-medium text-ink">
                      {c.guess.name}
                      {c.guessCorrect === true && (
                        <span className="ml-1 font-bold text-accent">(적중 🎯)</span>
                      )}
                      {c.guessCorrect === false && (
                        <span className="ml-1 font-bold text-danger">(실패 ❌)</span>
                      )}
                    </span>
                  ) : (
                    <span className="italic">미제출</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
