"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorText } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { ParticipantState } from "@/lib/types";

interface GuessCardProps {
  guess: NonNullable<ParticipantState["guess"]>;
  refresh: () => Promise<void>;
}

export function GuessCard({ guess, refresh }: GuessCardProps) {
  const currentGuessId = guess.myGuess?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>(currentGuessId);
  const [prevGuessId, setPrevGuessId] = useState<string>(currentGuessId);

  // Sync state during render when server updates guess
  if (currentGuessId !== prevGuessId) {
    setPrevGuessId(currentGuessId);
    setSelectedId(currentGuessId);
  }

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmitGuess = async () => {
    if (!selectedId) {
      setErrorMsg("비밀 마니또 후보를 한 명 선택해 주세요.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await api("/api/me/guess", { participantId: selectedId });
      setSavedSuccess(true);
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("추리 제출에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-brand/40 bg-linear-to-b from-brand/15 via-surface to-surface shadow-md">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink">
          🕵️ 최종 추리 시간
        </span>
        <Badge tone="warn">결과 공개 전까지 변경 가능</Badge>
      </div>

      <div className="mt-3">
        <h3 className="text-lg font-bold text-ink">
          🎭 나를 섬긴 비밀 마니또는 누구일까요?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          지금까지 해금된 키워드와 힌트를 바탕으로, 나를 섬겨준 비밀 마니또의 진짜 정체를 맞혀보세요!
        </p>
      </div>

      {/* Current guess status */}
      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-xs">
        <span className="text-ink-soft">현재 제출된 추리: </span>
        {guess.myGuess ? (
          <strong className="text-sm font-bold text-brand">
            {guess.myGuess.name} 님
          </strong>
        ) : (
          <span className="font-semibold text-warn">아직 제출하지 않음</span>
        )}
      </div>

      {/* Candidates Select / Grid */}
      <div className="mt-4 flex flex-col gap-2">
        <label
          htmlFor="guess-candidate-select"
          className="text-xs font-semibold text-ink"
        >
          비밀 마니또 후보 선택 (나를 제외한 참가자)
        </label>

        <select
          id="guess-candidate-select"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setSavedSuccess(false);
          }}
          disabled={loading}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-brand"
        >
          <option value="">-- 참가자를 선택하세요 --</option>
          {guess.candidates.map((cand) => (
            <option key={cand.id} value={cand.id}>
              {cand.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2">
        <ErrorText>{errorMsg}</ErrorText>
      </div>

      {savedSuccess && (
        <p className="mt-1 text-center text-xs font-semibold text-accent">
          ✓ 최종 추리가 저장되었습니다!
        </p>
      )}

      <Button
        variant="primary"
        loading={loading}
        onClick={handleSubmitGuess}
        disabled={!selectedId || loading}
        className="mt-3 w-full"
      >
        {guess.myGuess ? "추리 변경하기" : "최종 추리 제출하기"}
      </Button>
    </Card>
  );
}
