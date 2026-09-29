"use client";

import { Badge, Button, Card } from "@/components/ui";
import type { ParticipantState } from "@/lib/types";

interface TargetCardProps {
  target: NonNullable<ParticipantState["target"]>;
  approvedMissionCount: number;
  nextUnlockAt: number | null;
  joker: ParticipantState["joker"];
  onOpenJokerModal: () => void;
}

export function TargetCard({
  target,
  approvedMissionCount,
  nextUnlockAt,
  joker,
  onOpenJokerModal,
}: TargetCardProps) {
  const isAllUnlocked = target.keywords.every((k) => k.value !== null);

  // Joker state checks
  const hasPendingQuiz = Boolean(joker?.pendingQuiz);
  const canUseJoker = Boolean(joker?.available && !joker?.used);
  const jokerUsed = Boolean(joker?.used && !joker?.pendingQuiz);

  // Progress computation
  // Thresholds are usually [1, 3, 5]. If nextUnlockAt is null, all unlocked.
  const maxThreshold = 5;
  const progressPercent = nextUnlockAt === null
    ? 100
    : Math.min(100, Math.round((approvedMissionCount / maxThreshold) * 100));

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 타깃 메인 카드 */}
      <Card className="relative overflow-hidden border-brand/20 bg-linear-to-b from-brand/10 to-surface shadow-sm">
        {/* Decorative corner tag */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
            내가 섬길 타깃 마니또
          </span>
          <span className="text-xs font-medium text-ink-soft">
            해금 레벨: {target.unlockedLevel}/3
          </span>
        </div>

        {/* Big Anonymous Nickname */}
        <div className="my-4 text-center">
          <div className="mb-1 text-3xl font-black tracking-tight text-ink">
            {target.alias}
          </div>
          <p className="text-xs text-ink-soft">
            미션을 수행하여 이 분의 진짜 정체를 밝혀보세요!
          </p>
        </div>

        {/* Unlock Progress */}
        <div className="mt-2 rounded-xl bg-surface/80 p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">
              키워드 해금 진행도
            </span>
            <span className="font-bold text-accent">
              승인 미션 {approvedMissionCount}개
            </span>
          </div>

          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft">
            {isAllUnlocked ? (
              <span className="font-semibold text-accent">
                🎉 모든 키워드가 해금되었습니다!
              </span>
            ) : nextUnlockAt !== null ? (
              <span>
                다음 해금까지{" "}
                <strong className="text-ink">
                  {Math.max(0, nextUnlockAt - approvedMissionCount)}개
                </strong>{" "}
                승인 필요 (누적 {nextUnlockAt}개 목표)
              </span>
            ) : (
              <span>해금 완료</span>
            )}
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* 3 Keyword Slots */}
        <div className="mt-4 flex flex-col gap-2.5">
          {target.keywords.map((kw) => {
            const isUnlocked = kw.value !== null;
            const hasHint = !isUnlocked && Boolean(kw.hint);

            return (
              <div
                key={kw.slot}
                className={`flex flex-col gap-1 rounded-xl border p-3 transition ${
                  isUnlocked
                    ? "border-accent/40 bg-accent/5"
                    : hasHint
                      ? "border-brand/40 bg-brand/5"
                      : "border-line bg-surface-2/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-soft">
                    #{kw.slot} {kw.label}
                  </span>

                  {isUnlocked ? (
                    <Badge tone="accent">해금 완료 ✅</Badge>
                  ) : hasHint ? (
                    <Badge tone="brand">조커 힌트 획득 🃏</Badge>
                  ) : (
                    <Badge tone="neutral">🔒 잠김</Badge>
                  )}
                </div>

                {/* Content Area */}
                <div className="mt-1">
                  {isUnlocked ? (
                    <p className="text-base font-bold text-ink">
                      {kw.value}
                    </p>
                  ) : hasHint ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-soft">초성/힌트:</span>
                      <span className="font-mono text-base font-bold tracking-widest text-brand">
                        {kw.hint}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-soft/80">
                      미션을 승인받으면 키워드가 공개됩니다.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Joker Chance Button */}
        {joker && (
          <div className="mt-4 border-t border-line/60 pt-3">
            {hasPendingQuiz ? (
              <Button
                variant="primary"
                onClick={onOpenJokerModal}
                className="w-full animate-bounce shadow-md"
              >
                🃏 조커 퀴즈 풀기 (이어서 하기)
              </Button>
            ) : canUseJoker ? (
              <Button
                variant="secondary"
                onClick={onOpenJokerModal}
                className="w-full border-brand/40 text-brand hover:bg-brand/10"
              >
                🃏 조커 찬스 사용하기 (1회 가능)
              </Button>
            ) : jokerUsed ? (
              <Button
                variant="secondary"
                disabled
                className="w-full cursor-not-allowed opacity-60"
              >
                {joker.solved
                  ? "✓ 조커 찬스 완료 (힌트 획득)"
                  : "조커 찬스 사용 완료 (오답)"}
              </Button>
            ) : isAllUnlocked ? (
              <p className="text-center text-xs text-ink-soft">
                모든 키워드가 이미 해금되어 조커 찬스가 필요하지 않아요.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
