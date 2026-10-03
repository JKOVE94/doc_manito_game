"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { BetView, Faction, Prediction } from "@/lib/types";

interface BetPanelProps {
  bet: BetView;
  refresh: () => Promise<void>;
}

export function BetPanel({ bet, refresh }: BetPanelProps) {
  // Flip card state for hidden quest
  const [isFlipped, setIsFlipped] = useState(false);

  const isOpen = bet.status === "OPEN";
  const isLocked = bet.status === "LOCKED";
  const isResult = bet.status === "RESULT";

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 히든 퀘스트 뒤집기 카드 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>🎴 나의 히든 퀘스트</SectionTitle>
          <span className="text-xs text-ink-soft">탭하여 뒤집기 🔄</span>
        </div>

        {/* 3D Flip Card Container */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsFlipped((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsFlipped((prev) => !prev);
            }
          }}
          className="relative min-h-[160px] w-full cursor-pointer select-none rounded-2xl transition-transform active:scale-[0.99] [perspective:1000px]"
          aria-label="히든 퀘스트 카드"
        >
          <div
            className={`relative h-full min-h-[160px] w-full rounded-2xl border transition-all duration-500 [transform-style:preserve-3d] ${
              isFlipped ? "[transform:rotateY(180deg)]" : ""
            } ${
              isFlipped
                ? "border-accent/40 bg-surface shadow-md"
                : "border-brand/40 bg-linear-to-br from-brand/20 via-surface to-brand/10 shadow-sm"
            }`}
          >
            {/* Front Face: Sealed card */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center p-5 text-center [backface-visibility:hidden] ${
                isFlipped ? "pointer-events-none" : ""
              }`}
            >
              <div className="mb-2 text-4xl" aria-hidden="true">
                🔮
              </div>
              <h4 className="text-base font-bold text-ink">
                시크릿 히틀러 히든 퀘스트
              </h4>
              <p className="mt-1 text-xs text-ink-soft">
                카드를 터치하면 비밀 지령이 나타납니다!
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-brand">
                터치하여 열기 👆
              </span>
            </div>

            {/* Back Face: Revealed quest */}
            <div
              className={`absolute inset-0 flex flex-col justify-between p-5 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                !isFlipped ? "pointer-events-none" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                    비밀 지령
                  </span>
                  <span className="text-[11px] text-ink-soft">다시 탭하여 닫기</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-relaxed text-ink">
                  {bet.hiddenQuest ?? "배정된 히든 퀘스트가 없습니다."}
                </p>
              </div>

              <div className="mt-2 text-[11px] text-ink-soft/80">
                💡 게임 중 타깃과 자연스럽게 이 미션을 수행해보세요!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 시크릿 히틀러 배팅 섹션 */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle right={<a href="/rules" target="_blank" rel="noopener" className="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3 text-xs font-semibold text-ink-soft hover:text-ink">📖 룰북</a>}>🎲 시크릿 히틀러 승패 배팅</SectionTitle>
          <div>
            {isOpen && <Badge tone="brand">배팅 진행 중 🟢</Badge>}
            {isLocked && <Badge tone="warn">배팅 마감 🔒</Badge>}
            {isResult && <Badge tone="accent">결과 발표 🏆</Badge>}
          </div>
        </div>

        {/* Status: RESULT */}
        {isResult && (
          <div className="my-3 flex flex-col gap-3">
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
              <span className="text-xs text-ink-soft">최종 승리 진영</span>
              <div className="mt-1 text-xl font-black text-ink">
                {bet.winningFaction === "LIBERAL" ? "자유당 🕊️ 승리!" : "파시스트 🦅 승리!"}
              </div>
            </div>

            <div
              className={`rounded-2xl border p-4 text-center ${
                bet.myBetCorrect === true
                  ? "border-accent/40 bg-accent/10"
                  : bet.myBetCorrect === false
                    ? "border-danger/40 bg-danger/10"
                    : "border-line bg-surface-2"
              }`}
            >
              {bet.myBetCorrect === true ? (
                <>
                  <span className="text-3xl" aria-hidden="true">
                    🎯
                  </span>
                  <h4 className="mt-1 text-base font-bold text-accent">
                    예측 적중 성공! 축하합니다!
                  </h4>
                  <p className="mt-1 text-xs text-ink-soft">
                    탁월한 통찰력으로 게임의 승패를 맞추셨습니다!
                  </p>
                </>
              ) : bet.myBetCorrect === false ? (
                <>
                  <span className="text-3xl" aria-hidden="true">
                    💥
                  </span>
                  <h4 className="mt-1 text-base font-bold text-danger">
                    아쉽게도 적중 실패!
                  </h4>
                  <p className="mt-1 text-xs text-ink-soft">
                    예측이 빗나갔지만 멋진 승부였습니다!
                  </p>
                </>
              ) : (
                <>
                  <span className="text-3xl" aria-hidden="true">
                    🤷
                  </span>
                  <h4 className="mt-1 text-base font-bold text-ink">
                    배팅에 참여하지 않았습니다
                  </h4>
                </>
              )}

              {bet.mine && (
                <div className="mt-3 text-xs text-ink-soft">
                  내가 한 배팅:{" "}
                  <strong className="text-ink">
                    {bet.mine.faction === "LIBERAL" ? "자유당" : "파시스트"}{" "}
                    {bet.mine.prediction === "WIN" ? "승리" : "패배"}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status: LOCKED */}
        {isLocked && (
          <div className="my-3 flex flex-col gap-3 text-center">
            <div className="rounded-xl border border-warn/30 bg-warn/10 p-4">
              <span className="text-3xl" aria-hidden="true">
                🔒
              </span>
              <h4 className="mt-1 text-base font-bold text-warn">
                배팅이 마감되었습니다
              </h4>
              <p className="mt-1 text-xs text-ink-soft">
                게임이 종료된 후 호스트가 결과를 발표하면 적중 여부가 공개됩니다.
              </p>

              <div className="mt-3 rounded-lg bg-surface p-2.5 text-xs">
                <span className="text-ink-soft">내 배팅: </span>
                <span className="font-bold text-ink">
                  {bet.mine
                    ? `${bet.mine.faction === "LIBERAL" ? "자유당 🕊️" : "파시스트 🦅"} ${
                        bet.mine.prediction === "WIN" ? "승리 🏆" : "패배 💀"
                      }`
                    : "배팅 미참여"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status: OPEN */}
        {isOpen && (
          <BetForm
            key={`${bet.mine?.faction ?? "none"}-${bet.mine?.prediction ?? "none"}`}
            bet={bet}
            refresh={refresh}
          />
        )}
      </Card>
    </div>
  );
}

function BetForm({ bet, refresh }: { bet: BetView; refresh: () => Promise<void> }) {
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(
    bet.mine?.faction ?? null,
  );
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(
    bet.mine?.prediction ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handlePlaceBet = async () => {
    if (!selectedFaction || !selectedPrediction) {
      setErrorMsg("진영과 승/패 예측을 모두 선택해주세요.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await api("/api/me/bet", {
        faction: selectedFaction,
        prediction: selectedPrediction,
      });
      setSavedSuccess(true);
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("배팅 제출에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-ink-soft">
        시크릿 히틀러 보드게임에서 어떤 진영이 승리하거나 패배할지 예측해 보세요!
      </p>

      {/* Current choice indicator */}
      {bet.mine && (
        <div className="rounded-xl bg-surface-2 p-2.5 text-xs text-ink-soft">
          <span>현재 제출된 배팅: </span>
          <strong className="text-brand">
            {bet.mine.faction === "LIBERAL" ? "자유당" : "파시스트"}{" "}
            {bet.mine.prediction === "WIN" ? "승리" : "패배"}
          </strong>
          <span className="ml-1 text-[11px]">(마감 전까지 변경 가능)</span>
        </div>
      )}

      {/* Faction Selection */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-ink">
          1. 진영 선택
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedFaction("LIBERAL")}
            disabled={loading}
            className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 text-sm font-bold transition active:scale-95 ${
              selectedFaction === "LIBERAL"
                ? "border-brand bg-brand text-brand-ink shadow-sm"
                : "border-line bg-surface text-ink hover:border-brand/40"
            }`}
          >
            <span>자유당 🕊️</span>
            <span className="text-[10px] font-normal opacity-80">
              LIBERAL
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFaction("FASCIST")}
            disabled={loading}
            className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 text-sm font-bold transition active:scale-95 ${
              selectedFaction === "FASCIST"
                ? "border-brand bg-brand text-brand-ink shadow-sm"
                : "border-line bg-surface text-ink hover:border-brand/40"
            }`}
          >
            <span>파시스트 🦅</span>
            <span className="text-[10px] font-normal opacity-80">
              FASCIST
            </span>
          </button>
        </div>
      </div>

      {/* Prediction Selection */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-ink">
          2. 예측 선택
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedPrediction("WIN")}
            disabled={loading}
            className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 text-sm font-bold transition active:scale-95 ${
              selectedPrediction === "WIN"
                ? "border-accent bg-accent text-white shadow-sm"
                : "border-line bg-surface text-ink hover:border-accent/40"
            }`}
          >
            <span>승리 🏆</span>
            <span className="text-[10px] font-normal opacity-80">WIN</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPrediction("LOSE")}
            disabled={loading}
            className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 text-sm font-bold transition active:scale-95 ${
              selectedPrediction === "LOSE"
                ? "border-ink-soft bg-surface-2 text-ink shadow-sm ring-1 ring-line"
                : "border-line bg-surface text-ink hover:border-ink-soft/40"
            }`}
          >
            <span>패배 💀</span>
            <span className="text-[10px] font-normal opacity-80">LOSE</span>
          </button>
        </div>
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      {savedSuccess && (
        <p className="text-center text-xs font-semibold text-accent">
          ✓ 배팅이 성공적으로 저장되었습니다!
        </p>
      )}

      <Button
        variant="primary"
        loading={loading}
        onClick={handlePlaceBet}
        disabled={!selectedFaction || !selectedPrediction || loading}
        className="w-full"
      >
        {bet.mine ? "배팅 변경하기" : "배팅 제출하기"}
      </Button>
    </div>
  );
}
