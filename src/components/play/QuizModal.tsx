"use client";

import { useEffect, useState } from "react";
import { Badge, ErrorText } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { QuizAnswerResult, QuizPendingView } from "@/lib/types";

interface QuizModalProps {
  quiz: QuizPendingView;
  clockOffsetMs: number;
  refresh: () => Promise<void>;
}

export function QuizModal({
  quiz,
  clockOffsetMs,
  refresh,
}: QuizModalProps) {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAnswerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + clockOffsetMs);
    }, 250);
    return () => clearInterval(timer);
  }, [clockOffsetMs]);
  const expiresTime = new Date(quiz.expiresAt).getTime();
  const diffMs = expiresTime - now;
  const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));
  const isTimedOut = remainingSec <= 0 && !result;

  // Handle timeout auto refresh
  useEffect(() => {
    if (remainingSec <= 0 && !result && !submitting) {
      const timer = setTimeout(async () => {
        await refresh();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [remainingSec, result, submitting, refresh]);

  const handleSelectOption = async (idx: number) => {
    if (submitting || result || isTimedOut || remainingSec <= 0) return;

    setSelectedIdx(idx);
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api<QuizAnswerResult>("/api/me/quiz/answer", {
        quizId: quiz.id,
        optionIndex: idx,
      });
      setResult(res);
      setTimeout(async () => {
        await refresh();
      }, 2000);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("답안 제출에 실패했습니다.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
            <span>🧠</span> 깜짝 TMI 퀴즈!
          </span>

          <Badge tone={remainingSec <= 5 ? "danger" : "warn"}>
            ⏱️ {remainingSec}초 남음
          </Badge>
        </div>

        {/* Question Area */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-soft">이 TMI의 주인공은 누구일까요?</p>
          <h3 className="mt-1 text-base font-bold leading-snug text-ink break-words">
            &quot;{quiz.question}&quot;
          </h3>
        </div>

        {/* Result Feedback Banner */}
        {result && (
          <div
            className={`mt-4 rounded-xl p-3 text-center transition animate-fadeIn ${
              result.correct
                ? "border border-accent/40 bg-accent/10 text-accent font-bold"
                : "border border-danger/40 bg-danger/10 text-danger font-bold"
            }`}
          >
            {result.correct ? (
              <div>
                <span className="text-lg">🎉</span> 정답! 힌트 포인트 +1 🎉
              </div>
            ) : (
              <div>
                <div>아쉽게도 오답입니다! 😢</div>
                <div className="mt-0.5 text-xs font-medium text-ink-soft">
                  정답은 <strong className="text-ink">{result.correctAnswer}</strong> 님이었습니다.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timed out Banner */}
        {isTimedOut && !result && (
          <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-center text-xs font-bold text-warn">
            ⏱️ 시간 초과되었습니다! 다음 기회를 노려보세요.
          </div>
        )}

        {/* 4 Options */}
        <div className="mt-4 flex flex-col gap-2">
          {quiz.options.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrectAnswer = result?.correctAnswer === option;

            let buttonStyle =
              "border-line bg-surface-2 text-ink hover:border-brand/40 active:scale-[0.98]";

            if (result) {
              if (isCorrectAnswer) {
                buttonStyle = "border-accent bg-accent/20 text-accent font-bold shadow-xs";
              } else if (isSelected && !result.correct) {
                buttonStyle = "border-danger bg-danger/20 text-danger line-through opacity-80";
              } else {
                buttonStyle = "border-line/40 bg-surface-2/40 text-ink-soft opacity-40";
              }
            } else if (isSelected) {
              buttonStyle = "border-brand bg-brand/10 text-brand font-bold";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSelectOption(idx)}
                disabled={submitting || Boolean(result) || isTimedOut || remainingSec <= 0}
                className={`flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed ${buttonStyle}`}
              >
                <span>
                  {idx + 1}. {option}
                </span>
                {submitting && isSelected && !result && (
                  <span className="text-xs text-brand font-medium">제출 중…</span>
                )}
                {result && isCorrectAnswer && (
                  <span className="text-sm">✅</span>
                )}
                {result && isSelected && !result.correct && (
                  <span className="text-sm">❌</span>
                )}
              </button>
            );
          })}
        </div>

        <ErrorText>{errorMsg}</ErrorText>
      </div>
    </div>
  );
}
