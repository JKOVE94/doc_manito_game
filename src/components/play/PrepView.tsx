"use client";

import { useState } from "react";
import { Button, Card, ErrorText, Input, SectionTitle } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { ParticipantState } from "@/lib/types";

interface PrepViewProps {
  state: ParticipantState;
  refresh: () => Promise<void>;
}

export function PrepView({ state, refresh }: PrepViewProps) {
  // Lie turn state
  const [lieTurnSaving, setLieTurnSaving] = useState(false);
  const [lieTurnError, setLieTurnError] = useState<string | null>(null);
  const [showLieTurn, setShowLieTurn] = useState(false);

  const handleSelectLieTurn = async (turn: 1 | 2 | 3 | 4) => {
    if (state.me.lieTurn === turn) return; // already selected

    setLieTurnSaving(true);
    setLieTurnError(null);

    try {
      await api("/api/me/lie-turn", { lieTurn: turn });
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setLieTurnError(err.message);
      } else {
        setLieTurnError("거짓말 순번 저장에 실패했습니다.");
      }
    } finally {
      setLieTurnSaving(false);
    }
  };

  const participantCount = state.session.participantCount;
  const minParticipants = 4;
  const isReadyToStart = participantCount >= minParticipants;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 대기 안내 배너 */}
      <Card className="border-brand/30 bg-brand/5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">
            ⏳
          </span>
          <div className="flex-1">
            <h3 className="text-base font-bold text-ink">
              게임 시작을 기다리고 있어요
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              관리자가 게임을 시작하면 자동으로 다음 화면으로 넘어가요.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">
                참가자 {participantCount}명 / 최소 {minParticipants}명
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isReadyToStart ? "text-accent" : "text-warn"
                }`}
              >
                {isReadyToStart
                  ? "✓ 최소 인원 충족"
                  : `${minParticipants - participantCount}명 더 필요`}
              </span>
            </div>
            {/* Simple progress bar */}
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full transition-all duration-500 ${
                  isReadyToStart ? "bg-accent" : "bg-warn"
                }`}
                style={{
                  width: `${Math.min(100, (participantCount / minParticipants) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2. TMI 키워드 3종 입력 폼 (keyed by revision for clean state reset) */}
      <KeywordForm key={state.revision} state={state} refresh={refresh} />

      {/* 3. 거짓말 순번 비밀 선택 */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>🤫 거짓말 순번 비밀 선택</SectionTitle>
          <button
            type="button"
            onClick={() => setShowLieTurn((prev) => !prev)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-soft transition hover:text-ink"
          >
            {showLieTurn ? "🙈 숨기기" : "👁️ 보기"}
          </button>
        </div>

        <p className="mb-3 text-xs leading-relaxed text-ink-soft">
          거짓·진실 게임에서 내가 <strong className="text-ink">거짓말을 말할 순번(1~4번)</strong>을 비밀리에 선택하세요. 옆 사람이 보지 못하게 화면을 가려주세요!
        </p>

        <div className="mb-4 rounded-xl bg-surface-2 p-3 text-center">
          <span className="text-xs text-ink-soft">현재 내 선택: </span>
          <span className="text-sm font-bold text-brand">
            {state.me.lieTurn
              ? showLieTurn
                ? `${state.me.lieTurn}번째 발언에서 거짓말`
                : "비밀 유지 중 (●)"
              : "아직 선택하지 않음"}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as const).map((turn) => {
            const isSelected = state.me.lieTurn === turn;
            return (
              <button
                key={turn}
                type="button"
                onClick={() => handleSelectLieTurn(turn)}
                disabled={lieTurnSaving}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 font-bold transition active:scale-95 disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-brand bg-brand text-brand-ink shadow-sm"
                    : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-surface-2"
                }`}
              >
                <span className="text-base">
                  {showLieTurn ? `${turn}번` : isSelected ? "●" : `${turn}번`}
                </span>
                <span className="text-[10px] font-normal opacity-80">
                  {turn === 1
                    ? "첫번째"
                    : turn === 2
                      ? "두번째"
                      : turn === 3
                        ? "세번째"
                        : "네번째"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          <ErrorText>{lieTurnError}</ErrorText>
        </div>
      </Card>
    </div>
  );
}

function KeywordForm({
  state,
  refresh,
}: {
  state: ParticipantState;
  refresh: () => Promise<void>;
}) {
  const initialK1 = state.me.keywords.find((k) => k.slot === 1)?.value ?? "";
  const initialK2 = state.me.keywords.find((k) => k.slot === 2)?.value ?? "";
  const initialK3 = state.me.keywords.find((k) => k.slot === 3)?.value ?? "";

  const [kw1, setKw1] = useState(initialK1);
  const [kw2, setKw2] = useState(initialK2);
  const [kw3, setKw3] = useState(initialK3);
  const [keywordSaving, setKeywordSaving] = useState(false);
  const [keywordSaved, setKeywordSaved] = useState(
    Boolean(initialK1 && initialK2 && initialK3),
  );
  const [keywordError, setKeywordError] = useState<string | null>(null);

  const labelForSlot = (slotNum: 1 | 2 | 3) => {
    return (
      state.keywordSlots.find((s) => s.slot === slotNum)?.label ??
      `키워드 #${slotNum}`
    );
  };

  const handleSaveKeywords = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const t1 = kw1.trim();
    const t2 = kw2.trim();
    const t3 = kw3.trim();

    if (!t1 || !t2 || !t3) {
      setKeywordError("키워드 3개를 모두 입력해주세요.");
      return;
    }
    if (t1.length > 30 || t2.length > 30 || t3.length > 30) {
      setKeywordError("각 키워드는 1자 이상 30자 이하여야 합니다.");
      return;
    }

    setKeywordSaving(true);
    setKeywordError(null);
    setKeywordSaved(false);

    try {
      await api("/api/me/keywords", {
        keywords: [t1, t2, t3],
      });
      setKeywordSaved(true);
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setKeywordError(err.message);
      } else {
        setKeywordError("키워드 저장에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setKeywordSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        right={
          keywordSaved && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              ✓ 저장 완료
            </span>
          )
        }
      >
        📝 TMI 키워드 3종 등록
      </SectionTitle>
      <p className="mb-4 text-xs leading-relaxed text-ink-soft">
        나를 섬기는 마니또가 미션을 완수할 때마다 하나씩 해금됩니다. 나를 추리할 수 있는 재미있는 힌트를 적어주세요! (각 1~30자)
      </p>

      <form onSubmit={handleSaveKeywords} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="kw-slot-1"
            className="mb-1 block text-xs font-semibold text-ink"
          >
            1. {labelForSlot(1)}
          </label>
          <Input
            id="kw-slot-1"
            type="text"
            placeholder="예: 어릴 적 별명, 학창 시절 일화 등 (1~30자)"
            value={kw1}
            onChange={(e) => {
              setKw1(e.target.value);
              setKeywordSaved(false);
            }}
            maxLength={30}
            required
            disabled={keywordSaving}
          />
        </div>

        <div>
          <label
            htmlFor="kw-slot-2"
            className="mb-1 block text-xs font-semibold text-ink"
          >
            2. {labelForSlot(2)}
          </label>
          <Input
            id="kw-slot-2"
            type="text"
            placeholder="예: 빠져있는 취미, 최근 산 아이템 등 (1~30자)"
            value={kw2}
            onChange={(e) => {
              setKw2(e.target.value);
              setKeywordSaved(false);
            }}
            maxLength={30}
            required
            disabled={keywordSaving}
          />
        </div>

        <div>
          <label
            htmlFor="kw-slot-3"
            className="mb-1 block text-xs font-semibold text-ink"
          >
            3. {labelForSlot(3)}
          </label>
          <Input
            id="kw-slot-3"
            type="text"
            placeholder="예: 커피 내리기, 남다른 특기 등 (1~30자)"
            value={kw3}
            onChange={(e) => {
              setKw3(e.target.value);
              setKeywordSaved(false);
            }}
            maxLength={30}
            required
            disabled={keywordSaving}
          />
        </div>

        <ErrorText>{keywordError}</ErrorText>

        <Button
          type="submit"
          variant="primary"
          loading={keywordSaving}
          className="w-full"
          disabled={keywordSaving || !kw1.trim() || !kw2.trim() || !kw3.trim()}
        >
          {keywordSaved ? "키워드 수정하기" : "키워드 저장하기"}
        </Button>
      </form>
    </Card>
  );
}
