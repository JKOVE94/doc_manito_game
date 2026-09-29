"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { JokerQuizView, JokerView } from "@/lib/types";

interface JokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  joker: JokerView | null;
  refresh: () => Promise<void>;
}

type Step = "WARNING" | "QUIZ" | "RESULT";

export function JokerModal({
  isOpen,
  onClose,
  joker,
  refresh,
}: JokerModalProps) {
  const [step, setStep] = useState<Step>(() =>
    joker?.pendingQuiz ? "QUIZ" : "WARNING",
  );
  const [quiz, setQuiz] = useState<JokerQuizView | null>(
    () => joker?.pendingQuiz ?? null,
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    hint: string | null;
  } | null>(null);

  if (!isOpen) return null;

  const handleStartJoker = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<JokerQuizView>("/api/me/joker/start", {});
      setQuiz(data);
      setStep("QUIZ");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("조커 퀴즈를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerJoker = async () => {
    if (selectedOption === null) {
      setErrorMsg("보기 중 하나를 선택해주세요.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<{ correct: boolean; hint: string | null }>(
        "/api/me/joker/answer",
        { optionIndex: selectedOption },
      );
      setResult(res);
      setStep("RESULT");
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("답안 제출에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    await refresh();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl transition-all">
        {/* Step 1: Warning */}
        {step === "WARNING" && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="mb-2 text-4xl" aria-hidden="true">
                🃏
              </div>
              <h3 className="text-lg font-bold text-ink">
                조커 찬스를 사용하시겠습니까?
              </h3>
            </div>

            <div className="rounded-xl border border-warn/30 bg-warn/10 p-3.5 text-xs leading-relaxed text-ink">
              <p className="font-semibold text-warn">⚠️ 주의사항 (1회용)</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-ink-soft">
                <li>조커 찬스는 이번 게임 중 <strong className="text-ink">단 1회</strong>만 사용 가능합니다.</li>
                <li>타깃의 잠긴 키워드 중 하나에 대한 4지선다 퀴즈가 출제됩니다.</li>
                <li>정답을 맞히면 키워드의 <strong className="text-ink">초성 또는 힌트</strong>가 즉시 해금됩니다!</li>
                <li>틀릴 경우 추가 기회 없이 기회가 소진됩니다.</li>
              </ul>
            </div>

            <ErrorText>{errorMsg}</ErrorText>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="primary"
                loading={loading}
                onClick={handleStartJoker}
                className="w-full"
              >
                도전하기! (퀴즈 시작)
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="w-full"
              >
                다음에 하기
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Quiz */}
        {step === "QUIZ" && quiz && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand">
                  🃏 조커 퀴즈
                </span>
                <span className="text-xs text-ink-soft">선택 후 제출</span>
              </div>
              <h3 className="mt-2 text-base font-bold leading-snug text-ink">
                {quiz.question}
              </h3>
              <p className="mt-1 text-xs text-ink-soft">
                타깃의 진짜 키워드라고 생각되는 보기를 골라주세요!
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {quiz.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedOption(idx);
                      setErrorMsg(null);
                    }}
                    disabled={loading}
                    className={`flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] ${
                      isSelected
                        ? "border-brand bg-brand/10 text-brand shadow-xs"
                        : "border-line bg-surface-2 text-ink hover:border-brand/40"
                    }`}
                  >
                    <span>
                      {idx + 1}. {option}
                    </span>
                    <span
                      className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <ErrorText>{errorMsg}</ErrorText>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="primary"
                loading={loading}
                onClick={handleAnswerJoker}
                disabled={selectedOption === null || loading}
                className="w-full"
              >
                답안 제출하기
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "RESULT" && result && (
          <div className="flex flex-col items-center gap-4 text-center">
            {result.correct ? (
              <>
                <div className="text-5xl animate-bounce" aria-hidden="true">
                  🎉
                </div>
                <div>
                  <h3 className="text-xl font-black text-accent">
                    정답입니다! 👏
                  </h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    조커 찬스로 타깃의 키워드 힌트를 획득했습니다!
                  </p>
                </div>

                <div className="w-full rounded-2xl border border-accent/40 bg-accent/10 p-4">
                  <span className="text-xs font-semibold text-accent">
                    획득한 힌트
                  </span>
                  <div className="mt-1 font-mono text-2xl font-black tracking-widest text-ink">
                    {result.hint}
                  </div>
                  <p className="mt-2 text-[11px] text-ink-soft">
                    마니또 카드에서 언제든지 다시 확인할 수 있습니다.
                  </p>
                </div>

                <Button
                  variant="primary"
                  onClick={handleFinish}
                  className="w-full"
                >
                  확인 완료
                </Button>
              </>
            ) : (
              <>
                <div className="text-5xl" aria-hidden="true">
                  😢
                </div>
                <div>
                  <h3 className="text-xl font-bold text-danger">
                    아쉽게도 오답입니다!
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    조커 찬스가 소진되었습니다.<br />
                    미션을 완수하여 키워드를 정상 해금해 보세요!
                  </p>
                </div>

                <Button
                  variant="secondary"
                  onClick={handleFinish}
                  className="w-full"
                >
                  닫기
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
