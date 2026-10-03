"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorText, Input } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { MailboxView } from "@/lib/types";

interface MailboxPanelProps {
  mailbox: MailboxView;
  targetName: string;
  refresh: () => Promise<void>;
}

type Tab = "inbox" | "sent";

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function MailboxPanel({
  mailbox,
  targetName,
  refresh,
}: MailboxPanelProps) {
  const [tab, setTab] = useState<Tab>("inbox");

  // Inbox answering state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});

  // Sent questions state
  const [toTargetQuestion, setToTargetQuestion] = useState("");
  const [sendingToTarget, setSendingToTarget] = useState(false);
  const [toTargetError, setToTargetError] = useState<string | null>(null);

  const [toManitoQuestion, setToManitoQuestion] = useState("");
  const [sendingToManito, setSendingToManito] = useState(false);
  const [toManitoError, setToManitoError] = useState<string | null>(null);

  const handleAnswerSubmit = async (mailId: string) => {
    const answer = (answers[mailId] ?? "").trim();
    if (!answer) {
      setAnswerErrors((prev) => ({ ...prev, [mailId]: "답장 내용을 입력해 주세요." }));
      return;
    }
    if (answer.length > 300) {
      setAnswerErrors((prev) => ({ ...prev, [mailId]: "답장은 최대 300자까지 가능합니다." }));
      return;
    }

    setAnsweringId(mailId);
    setAnswerErrors((prev) => ({ ...prev, [mailId]: "" }));

    try {
      await api("/api/me/mail/answer", { mailId, answer });
      setAnswers((prev) => ({ ...prev, [mailId]: "" }));
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setAnswerErrors((prev) => ({ ...prev, [mailId]: err.message }));
      } else {
        setAnswerErrors((prev) => ({ ...prev, [mailId]: "답장 전송에 실패했습니다." }));
      }
    } finally {
      setAnsweringId(null);
    }
  };

  const handleSendToTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = toTargetQuestion.trim();
    if (trimmed.length < 2) {
      setToTargetError("질문은 2자 이상 입력해 주세요.");
      return;
    }
    if (trimmed.length > 200) {
      setToTargetError("질문은 200자 이하로 입력해 주세요.");
      return;
    }

    setSendingToTarget(true);
    setToTargetError(null);

    try {
      await api("/api/me/mail/send", { to: "TARGET", question: trimmed });
      setToTargetQuestion("");
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setToTargetError(err.message);
      } else {
        setToTargetError("질문 전송에 실패했습니다.");
      }
    } finally {
      setSendingToTarget(false);
    }
  };

  const handleSendToManito = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = toManitoQuestion.trim();
    if (trimmed.length < 2) {
      setToManitoError("질문은 2자 이상 입력해 주세요.");
      return;
    }
    if (trimmed.length > 200) {
      setToManitoError("질문은 200자 이하로 입력해 주세요.");
      return;
    }

    setSendingToManito(true);
    setToManitoError(null);

    try {
      await api("/api/me/mail/send", { to: "MANITO", question: trimmed });
      setToManitoQuestion("");
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setToManitoError(err.message);
      } else {
        setToManitoError("질문 전송에 실패했습니다.");
      }
    } finally {
      setSendingToManito(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Segment Tab */}
      <div className="flex rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setTab("inbox")}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
            tab === "inbox"
              ? "bg-surface text-brand shadow-xs"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          <span>📥 받은 질문</span>
          {mailbox.unansweredCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {mailbox.unansweredCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab("sent")}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
            tab === "sent"
              ? "bg-surface text-brand shadow-xs"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          <span>📤 보낸 질문</span>
        </button>
      </div>

      {/* 1. 받은 질문 (Inbox) */}
      {tab === "inbox" && (
        <div className="flex flex-col gap-3">
          {mailbox.inbox.length === 0 ? (
            <Card className="py-12 text-center text-ink-soft">
              <span className="text-4xl" aria-hidden="true">
                💌
              </span>
              <h3 className="mt-3 text-base font-bold text-ink">
                도착한 질문이 아직 없습니다
              </h3>
              <p className="mt-1 text-xs">
                비밀 마니또나 섬기는 친구가 질문을 보내면 여기에 도착해요.
              </p>
            </Card>
          ) : (
            mailbox.inbox.map((item) => {
              const isManito = item.from === "MY_MANITO";
              const isAnswering = answeringId === item.id;
              const hasAnswer = Boolean(item.answer);

              return (
                <Card key={item.id} className="flex flex-col gap-3 shadow-xs">
                  {/* Sender Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isManito
                          ? "bg-accent/15 text-accent"
                          : "bg-brand/15 text-brand"
                      }`}
                    >
                      {isManito ? (
                        <>
                          <span>🎭</span>
                          <span>비밀 마니또</span>
                        </>
                      ) : (
                        <>
                          <span>💝</span>
                          <span>{item.fromLabel}</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-ink-soft">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Question Content */}
                  <div className="rounded-xl bg-surface-2 p-3">
                    <span className="text-[11px] font-semibold text-ink-soft">
                      질문:
                    </span>
                    <p className="mt-0.5 text-sm font-bold text-ink break-words">
                      {item.question}
                    </p>
                  </div>

                  {/* Answer section */}
                  {hasAnswer ? (
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                      <div className="flex items-center justify-between text-[11px] text-ink-soft mb-1">
                        <span className="font-semibold text-accent">
                          ✓ 내 답변
                        </span>
                        {item.answeredAt && (
                          <span>{formatDateTime(item.answeredAt)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-ink break-words leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleAnswerSubmit(item.id);
                      }}
                      className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-2.5"
                    >
                      <label
                        htmlFor={`answer-input-${item.id}`}
                        className="text-xs font-semibold text-ink"
                      >
                        답장 남기기 (1회만 작성 가능)
                      </label>
                      <textarea
                        id={`answer-input-${item.id}`}
                        rows={2}
                        placeholder="정성껏 솔직하게 답장해 주세요 (최대 300자)"
                        maxLength={300}
                        value={answers[item.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        disabled={isAnswering}
                        className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-brand"
                      />
                      <ErrorText>{answerErrors[item.id]}</ErrorText>
                      <Button
                        type="submit"
                        variant="primary"
                        loading={isAnswering}
                        disabled={isAnswering || !(answers[item.id] ?? "").trim()}
                        className="w-full text-xs"
                      >
                        답장 보내기
                      </Button>
                    </form>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* 2. 보낸 질문 (Sent) */}
      {tab === "sent" && (
        <div className="flex flex-col gap-5">
          {/* Section A: toTarget */}
          <Card className="flex flex-col gap-3 border-brand/20 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="flex items-center gap-1.5 text-base font-bold text-ink">
                  <span>💝</span>
                  <span>{targetName} 님에게</span>
                </h4>
                <p className="mt-0.5 text-xs text-ink-soft">
                  상대는 내가 누구인지 몰라요 (익명 전송)
                </p>
              </div>
              <Badge tone={mailbox.toTarget.remaining > 0 ? "brand" : "neutral"}>
                남은 횟수 {mailbox.toTarget.remaining}/{mailbox.limit}
              </Badge>
            </div>

            {/* List of questions to target */}
            <div className="flex flex-col gap-2">
              {mailbox.toTarget.items.length === 0 ? (
                <div className="rounded-xl bg-surface-2/60 p-3 text-center text-xs text-ink-soft">
                  아직 {targetName} 님에게 보낸 질문이 없어요.
                </div>
              ) : (
                mailbox.toTarget.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2/40 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-ink-soft text-[11px]">
                      <span className="font-semibold text-ink">내가 보낸 질문</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-ink break-words">
                      {item.question}
                    </p>

                    {item.answer ? (
                      <div className="mt-1 rounded-lg bg-surface p-2.5 border border-line">
                        <div className="flex items-center justify-between text-[11px] text-accent mb-0.5 font-semibold">
                          <span>💬 {targetName} 님의 답장</span>
                          {item.answeredAt && (
                            <span className="text-ink-soft font-normal">
                              {formatDateTime(item.answeredAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink font-medium break-words leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-warn">
                        ⏳ 답장 기다리는 중…
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Send Form to Target */}
            <form onSubmit={handleSendToTarget} className="mt-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={
                    mailbox.toTarget.remaining > 0
                      ? `${targetName} 님에게 물어보고 싶은 질문 (2~200자)`
                      : "질문 횟수를 모두 사용했어요"
                  }
                  maxLength={200}
                  value={toTargetQuestion}
                  onChange={(e) => {
                    setToTargetQuestion(e.target.value);
                    if (toTargetError) setToTargetError(null);
                  }}
                  disabled={mailbox.toTarget.remaining <= 0 || sendingToTarget}
                  className="text-sm"
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={sendingToTarget}
                  disabled={
                    mailbox.toTarget.remaining <= 0 ||
                    sendingToTarget ||
                    toTargetQuestion.trim().length < 2
                  }
                  className="shrink-0 px-4 text-xs"
                >
                  보내기
                </Button>
              </div>
              <ErrorText>{toTargetError}</ErrorText>
            </form>
          </Card>

          {/* Section B: toManito */}
          <Card className="flex flex-col gap-3 border-accent/20 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="flex items-center gap-1.5 text-base font-bold text-ink">
                  <span>🎭</span>
                  <span>비밀 마니또에게</span>
                </h4>
                <p className="mt-0.5 text-xs text-ink-soft">
                  상대는 내 이름을 알아요
                </p>
              </div>
              <Badge tone={mailbox.toManito.remaining > 0 ? "accent" : "neutral"}>
                남은 횟수 {mailbox.toManito.remaining}/{mailbox.limit}
              </Badge>
            </div>

            {/* List of questions to manito */}
            <div className="flex flex-col gap-2">
              {mailbox.toManito.items.length === 0 ? (
                <div className="rounded-xl bg-surface-2/60 p-3 text-center text-xs text-ink-soft">
                  아직 비밀 마니또에게 보낸 질문이 없어요.
                </div>
              ) : (
                mailbox.toManito.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2/40 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between text-ink-soft text-[11px]">
                      <span className="font-semibold text-ink">내가 보낸 질문</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-ink break-words">
                      {item.question}
                    </p>

                    {item.answer ? (
                      <div className="mt-1 rounded-lg bg-surface p-2.5 border border-line">
                        <div className="flex items-center justify-between text-[11px] text-accent mb-0.5 font-semibold">
                          <span>💬 비밀 마니또의 답장</span>
                          {item.answeredAt && (
                            <span className="text-ink-soft font-normal">
                              {formatDateTime(item.answeredAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink font-medium break-words leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-warn">
                        ⏳ 답장 기다리는 중…
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Send Form to Manito */}
            <form onSubmit={handleSendToManito} className="mt-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={
                    mailbox.toManito.remaining > 0
                      ? "비밀 마니또에게 물어보고 싶은 질문 (2~200자)"
                      : "질문 횟수를 모두 사용했어요"
                  }
                  maxLength={200}
                  value={toManitoQuestion}
                  onChange={(e) => {
                    setToManitoQuestion(e.target.value);
                    if (toManitoError) setToManitoError(null);
                  }}
                  disabled={mailbox.toManito.remaining <= 0 || sendingToManito}
                  className="text-sm"
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={sendingToManito}
                  disabled={
                    mailbox.toManito.remaining <= 0 ||
                    sendingToManito ||
                    toManitoQuestion.trim().length < 2
                  }
                  className="shrink-0 px-4 text-xs"
                >
                  보내기
                </Button>
              </div>
              <ErrorText>{toManitoError}</ErrorText>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
