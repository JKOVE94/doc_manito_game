"use client";

import { Badge, Button, Card } from "@/components/ui";
import type { JokerView, ManitoView } from "@/lib/types";

interface ManitoCardProps {
  manito: ManitoView;
  joker: JokerView | null;
  onOpenJokerModal: () => void;
}

export function ManitoCard({
  manito,
  joker,
  onOpenJokerModal,
}: ManitoCardProps) {
  const sortedHints = [...manito.hints].sort((a, b) => a.level - b.level);
  const isAllUnlocked = manito.nextUnlockAt === null;

  // Joker state checks
  const hasPendingQuiz = Boolean(joker?.pendingQuiz);
  const canUseJoker = Boolean(joker?.available && !joker?.used);
  const jokerUsed = Boolean(joker?.used && !joker?.pendingQuiz);

  // Progress computation
  const progressPercent = isAllUnlocked
    ? 100
    : manito.nextUnlockAt && manito.nextUnlockAt > 0
      ? Math.min(100, Math.max(0, Math.round((manito.points / manito.nextUnlockAt) * 100)))
      : 0;

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-linear-to-b from-accent/10 via-surface to-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
          <span>🎭</span> 나를 섬기는 비밀 마니또
        </span>
        <span className="text-xs font-medium text-ink-soft">
          해금 레벨: {manito.unlockedLevel}/{manito.maxLevel}
        </span>
      </div>

      {/* Main Secret Title */}
      <div className="my-4 text-center">
        <div className="mb-1 text-2xl font-black tracking-tight text-ink">
          비밀 마니또 힌트
        </div>
        <p className="text-xs text-ink-soft">
          미션 승인과 퀴즈 정답으로 포인트를 모아 마니또의 정체를 밝혀보세요!
        </p>
      </div>

      {/* Point Progress Bar */}
      <div className="mt-2 rounded-xl bg-surface/90 p-3 shadow-xs border border-line/60">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">힌트 포인트 진행도</span>
          <span className="font-bold text-accent">
            현재 {manito.points}점
          </span>
        </div>

        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-soft">
          {isAllUnlocked ? (
            <span className="font-semibold text-accent">
              🎉 모든 힌트가 해금되었습니다!
            </span>
          ) : manito.nextUnlockAt !== null ? (
            <span>
              다음 해금까지{" "}
              <strong className="text-ink">
                {Math.max(0, manito.nextUnlockAt - manito.points)}점
              </strong>{" "}
              필요 (누적 {manito.nextUnlockAt}점 목표)
            </span>
          ) : (
            <span>해금 완료</span>
          )}
          <span className="font-semibold">{progressPercent}%</span>
        </div>

        {/* Source breakdown */}
        <div className="mt-2 border-t border-line/50 pt-2 text-[11px] text-ink-soft">
          <span>포인트 출처: </span>
          <strong className="text-ink">
            미션 {manito.pointSources.missions}
          </strong>
          <span> + </span>
          <strong className="text-ink">
            퀴즈 {manito.pointSources.quizzes}
          </strong>
        </div>
      </div>

      {/* Hints by level */}
      <div className="mt-4 flex flex-col gap-2.5">
        {sortedHints.map((hint) => {
          const isUnlocked = hint.value !== null;
          const hasJokerHint = !isUnlocked && Boolean(hint.hint);

          return (
            <div
              key={hint.level}
              className={`flex flex-col gap-1 rounded-xl border p-3 transition ${
                isUnlocked
                  ? "border-accent/40 bg-accent/5"
                  : hasJokerHint
                    ? "border-brand/40 bg-brand/5"
                    : "border-line bg-surface-2/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-soft">
                  #{hint.level}단계 {hint.label}
                </span>

                {isUnlocked ? (
                  <Badge tone="accent">해금 완료 ✅</Badge>
                ) : hasJokerHint ? (
                  <Badge tone="brand">조커 힌트 획득 🃏</Badge>
                ) : (
                  <Badge tone="neutral">🔒 잠김</Badge>
                )}
              </div>

              {/* Content Area */}
              <div className="mt-1">
                {isUnlocked ? (
                  <p className="text-base font-bold text-ink">
                    {hint.value}
                  </p>
                ) : hasJokerHint ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-soft">초성/힌트:</span>
                    <span className="font-mono text-base font-bold tracking-widest text-brand">
                      {hint.hint}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-ink-soft/80">
                    포인트를 모으면 힌트가 공개됩니다.
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
              모든 힌트가 이미 해금되어 조커 찬스가 필요하지 않아요.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
