"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ErrorText, Input } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { AskEntryView, AskResult, AskVerdict, AskView } from "@/lib/types";

export interface AskPanelProps {
  ask: AskView | null;
  alias: string;
  onRefresh: () => Promise<void>;
}

const VERDICT_CONFIG: Record<
  AskVerdict,
  { label: string; tone: "accent" | "danger" | "warn" | "neutral" }
> = {
  YES: { label: "예", tone: "accent" },
  NO: { label: "아니오", tone: "danger" },
  PARTLY: { label: "조금", tone: "warn" },
  UNKNOWN: { label: "알 수 없음", tone: "neutral" },
};

export function AskPanel(props: AskPanelProps) {
  if (!props.ask) {
    return null;
  }
  return <AskPanelInner ask={props.ask} alias={props.alias} onRefresh={props.onRefresh} />;
}

interface AskPanelInnerProps {
  ask: AskView;
  alias: string;
  onRefresh: () => Promise<void>;
}

function AskPanelInner({ ask, alias, onRefresh }: AskPanelInnerProps) {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isFirstMount = useRef(true);

  const isLastResultInHistory = lastResult
    ? ask.history.some(
        (h) =>
          (h.createdAt && h.createdAt === lastResult.createdAt) ||
          (h.question === lastResult.question && h.answer === lastResult.answer),
      )
    : false;

  const displayedHistory: AskEntryView[] =
    lastResult && !isLastResultInHistory
      ? [...ask.history, lastResult]
      : ask.history;

  const isInputDisabled = !ask.enabled || ask.remaining <= 0 || isLoading;
  const maxLength = ask.maxLength > 0 ? ask.maxLength : 100;
  const targetAlias = alias || "타깃";

  const placeholder = !ask.enabled
    ? "게임 진행 중에만 사용할 수 있어요"
    : ask.remaining <= 0
      ? "질문 기회를 모두 썼어요"
      : `예: "${targetAlias}님은 운동을 좋아하나요?"`;

  // Auto scroll down when new message or pending question appears
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      return;
    }
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [displayedHistory.length, pendingQuestion]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isInputDisabled || isLoading) return;

    const trimmed = question.trim();
    if (trimmed.length < 2) {
      setError("질문은 2자 이상 입력해 주세요.");
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`질문은 ${maxLength}자 이하로 입력해 주세요.`);
      return;
    }

    setError(null);
    setPendingQuestion(trimmed);
    setIsLoading(true);

    try {
      const res = await api<AskResult>("/api/me/ask", { question: trimmed });
      setQuestion("");
      setPendingQuestion(null);
      setLastResult(res);
      await onRefresh();
    } catch (err) {
      setPendingQuestion(null);
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("질문 전송에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[17px] font-bold tracking-tight text-ink">
            <span>🔮</span> AI 스무고개
          </h3>
          <Badge tone={ask.remaining > 0 ? "brand" : "neutral"}>
            남은 질문 {ask.remaining}/{ask.total}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          미션을 완료하면 질문 기회가 1개씩 늘어나요
        </p>
      </div>

      {/* Guide notice when disabled or exhausted */}
      {!ask.enabled ? (
        <div className="rounded-xl border border-line bg-surface-2/80 p-2.5 text-center text-xs text-ink-soft">
          게임 진행 중에만 사용할 수 있어요 (또는 AI 미설정)
        </div>
      ) : ask.remaining === 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-center text-xs font-semibold text-warn">
          질문 기회를 모두 썼어요
        </div>
      ) : null}

      {/* Chat History Box (Internal Scroll) */}
      <div
        ref={scrollContainerRef}
        className="flex max-h-72 min-h-24 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-xl bg-surface-2/40 p-3"
      >
        {displayedHistory.length === 0 && !pendingQuestion ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-xs text-ink-soft">
            <span className="mb-1 text-2xl" aria-hidden="true">
              💭
            </span>
            <p className="font-semibold text-ink">
              {targetAlias}님에 대해 자연어로 질문해 보세요!
            </p>
            <p className="mt-1 text-[11px] text-ink-soft/80">
              AI가 예 / 아니오 / 조금 / 알 수 없음과 힌트로 답해드립니다.
            </p>
          </div>
        ) : (
          <>
            {displayedHistory.map((item, idx) => {
              const verdictConf =
                VERDICT_CONFIG[item.verdict] ?? { label: "알 수 없음", tone: "neutral" as const };

              return (
                <div key={`${item.createdAt || "history"}-${idx}`} className="flex flex-col gap-2">
                  {/* 내 질문 (오른쪽) */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-brand px-3.5 py-2 text-sm text-brand-ink break-words whitespace-pre-wrap shadow-xs">
                      {item.question}
                    </div>
                  </div>

                  {/* AI 답변 (왼쪽) */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs border border-line bg-surface px-3.5 py-2 text-sm shadow-xs">
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">
                          <Badge tone={verdictConf.tone}>{verdictConf.label}</Badge>
                        </span>
                        <span className="leading-relaxed text-ink break-words">
                          {item.answer}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 요청 중: 내 질문 말풍선 + AI 생각 중 애니메이션 */}
            {pendingQuestion && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-brand px-3.5 py-2 text-sm text-brand-ink break-words whitespace-pre-wrap shadow-xs">
                    {pendingQuestion}
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-line bg-surface px-3.5 py-2.5 text-sm shadow-xs">
                    <span className="text-xs font-medium text-ink-soft">
                      생각 중…
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={isInputDisabled}
              className="pr-14 text-sm"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft/70">
              {question.length}/{maxLength}
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isInputDisabled || question.trim().length < 2}
            loading={isLoading}
            className="shrink-0 px-4"
          >
            질문
          </Button>
        </div>

        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}
