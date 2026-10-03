"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ErrorText, Input } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { AskEntryView, AskResult, AskVerdict, AskView } from "@/lib/types";

export interface AskPanelProps {
  ask: AskView | null;
  onRefresh: () => Promise<void>;
}

const VERDICT_CONFIG: Record<AskVerdict, { label: string; tone: "accent" | "danger" | "warn" | "neutral" }> = {
  YES: { label: "예", tone: "accent" },
  NO: { label: "아니오", tone: "danger" },
  PARTLY: { label: "조금", tone: "warn" },
  UNKNOWN: { label: "알 수 없음", tone: "neutral" },
};

/** 🔮 AI 스무고개: 나를 섬기는 비밀 마니또에 대해서만 질문 (섬기는 친구는 이미 공개라 제외) */
export function AskPanel({ ask, onRefresh }: AskPanelProps) {
  if (!ask) return null;
  return <AskPanelInner ask={ask} onRefresh={onRefresh} />;
}

function AskPanelInner({ ask, onRefresh }: { ask: AskView; onRefresh: () => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 가려진 답변(저장 안 됨)도 한 번은 보여주기 위해 마지막 응답을 로컬 보관
  const lastInHistory = lastResult
    ? ask.history.some((h) => h.createdAt === lastResult.createdAt || (h.question === lastResult.question && h.answer === lastResult.answer))
    : false;
  const history: AskEntryView[] = lastResult && !lastInHistory ? [...ask.history, lastResult] : ask.history;

  const disabled = !ask.enabled || ask.remaining <= 0 || isLoading;
  const maxLength = ask.maxLength > 0 ? ask.maxLength : 100;
  const placeholder = !ask.enabled
    ? "게임 진행 중에만 사용할 수 있어요"
    : ask.remaining <= 0
      ? "질문 기회를 모두 썼어요"
      : '예: "비밀 마니또는 운동을 좋아하나요?"';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history.length, pendingQuestion]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled) return;
    const q = question.trim();
    if (q.length < 2) return setError("질문은 2자 이상 입력해 주세요.");
    if (q.length > maxLength) return setError(`질문은 ${maxLength}자 이하로 입력해 주세요.`);
    setError(null);
    setPendingQuestion(q);
    setIsLoading(true);
    try {
      const res = await api<AskResult>("/api/me/ask", { question: q });
      setQuestion("");
      setLastResult(res);
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "질문 전송에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setPendingQuestion(null);
      setIsLoading(false);
    }
  };

  const bubbleQ = "max-w-[85%] rounded-2xl rounded-tr-xs bg-brand px-3.5 py-2 text-sm text-brand-ink break-words whitespace-pre-wrap shadow-xs";

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[17px] font-bold tracking-tight text-ink">
            <span>🔮</span> AI 스무고개
          </h3>
          <Badge tone={ask.remaining > 0 ? "brand" : "neutral"}>
            남은 질문 {ask.remaining}/{ask.total}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-ink-soft">🎭 나를 섬기는 비밀 마니또에 대해 물어보세요 (미션 완료 시 질문 +1)</p>
      </div>

      {!ask.enabled ? (
        <div className="rounded-xl border border-line bg-surface-2/80 p-2.5 text-center text-xs text-ink-soft">
          게임 진행 중에만 사용할 수 있어요 (또는 AI 미설정)
        </div>
      ) : ask.remaining === 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-center text-xs font-semibold text-warn">
          질문 기회를 모두 썼어요
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex max-h-72 min-h-24 flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-xl bg-surface-2/40 p-3"
      >
        {history.length === 0 && !pendingQuestion ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-xs text-ink-soft">
            <span className="mb-1 text-2xl" aria-hidden="true">
              💭
            </span>
            <p className="font-semibold text-ink">비밀 마니또에 대해 자연어로 질문해 보세요!</p>
            <p className="mt-1 text-[11px] text-ink-soft/80">AI가 예 / 아니오 / 조금 / 알 수 없음과 힌트로 답해드려요.</p>
          </div>
        ) : (
          <>
            {history.map((item, idx) => {
              const v = VERDICT_CONFIG[item.verdict] ?? VERDICT_CONFIG.UNKNOWN;
              return (
                <div key={`${item.createdAt}-${idx}`} className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <div className={bubbleQ}>{item.question}</div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs border border-line bg-surface px-3.5 py-2 text-sm shadow-xs">
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">
                          <Badge tone={v.tone}>{v.label}</Badge>
                        </span>
                        <span className="leading-relaxed text-ink break-words">{item.answer}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {pendingQuestion && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <div className={bubbleQ}>{pendingQuestion}</div>
                </div>
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-line bg-surface px-3.5 py-2.5 text-sm shadow-xs">
                    <span className="text-xs font-medium text-ink-soft">생각 중…</span>
                    <span className="flex items-center gap-1">
                      {[0, 150, 300].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={disabled}
              className="pr-14 text-sm"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft/70">
              {question.length}/{maxLength}
            </span>
          </div>
          <Button type="submit" disabled={disabled || question.trim().length < 2} loading={isLoading} className="shrink-0 px-4">
            질문
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}
