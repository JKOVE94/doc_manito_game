"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { ParticipantState, SubmissionStatus } from "@/lib/types";

const FACTION: Record<string, string> = { LIBERAL: "🕊️ 자유주의자", FASCIST: "🦅 파시스트" };
const PREDICTION: Record<string, string> = { WIN: "승리", LOSE: "패배" };
const SUBMISSION: Record<SubmissionStatus, { label: string; tone: "accent" | "warn" | "danger" }> = {
  PENDING: { label: "검토 중", tone: "warn" },
  APPROVED: { label: "승인 ✅", tone: "accent" },
  REJECTED: { label: "반려", tone: "danger" },
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-3.5">
      <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-ink-soft">{children}</p>;

/** 헤더 아이콘으로 여는 "내가 입력한 정보" 모달 (읽기 전용) */
export function MyInfoModal({ state, onClose }: { state: ParticipantState; onClose: () => void }) {
  const [showLie, setShowLie] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { me, bet, guess, mailbox, ask, quiz } = state;
  const submitted = state.missions.filter((m) => m.mySubmission);
  const label = (slot: number) => state.keywordSlots.find((k) => k.slot === slot)?.label ?? `키워드 ${slot}`;
  const sentTarget = mailbox?.toTarget.items ?? [];
  const sentManito = mailbox?.toManito.items ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="내 정보"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-bg shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="text-base font-bold text-ink">📋 내 정보</p>
            <p className="text-xs text-ink-soft">{me.name} 님이 입력·제출한 내용이에요</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="닫기" className="!min-h-11 !px-3 text-lg">
            ✕
          </Button>
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <Block title="✍️ 나를 소개하는 키워드">
            {me.keywords.length === 0 ? (
              <Empty>입력한 키워드가 없어요.</Empty>
            ) : (
              <ul className="space-y-1.5">
                {[...me.keywords]
                  .sort((a, b) => a.slot - b.slot)
                  .map((k) => (
                    <li key={k.slot} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-xs text-ink-soft">{label(k.slot)}</span>
                      <b className="text-right text-ink break-words">{k.value}</b>
                    </li>
                  ))}
              </ul>
            )}
          </Block>

          <Block title="🤫 거짓말 순번">
            {me.lieTurn === null ? (
              <Empty>아직 정하지 않았어요. 거짓·진실 탭에서 정할 수 있어요.</Empty>
            ) : (
              <div className="flex items-center justify-between">
                <b className="text-lg text-brand">{showLie ? `${me.lieTurn}번째` : "● 번째"}</b>
                <Button type="button" variant="secondary" onClick={() => setShowLie((v) => !v)} className="!min-h-10 text-xs">
                  {showLie ? "가리기 🙈" : "보기 👁"}
                </Button>
              </div>
            )}
          </Block>

          {bet && (
            <Block title="🎲 배팅 & 추리">
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between gap-3">
                  <span className="text-xs text-ink-soft">시크릿 히틀러 배팅</span>
                  <b className="text-ink">
                    {bet.mine ? `${FACTION[bet.mine.faction]} · ${PREDICTION[bet.mine.prediction]} 예측` : "아직 안 했어요"}
                  </b>
                </li>
                {guess && (
                  <li className="flex justify-between gap-3">
                    <span className="text-xs text-ink-soft">비밀 마니또 추리</span>
                    <b className="text-ink">{guess.myGuess ? guess.myGuess.name : "아직 안 골랐어요"}</b>
                  </li>
                )}
              </ul>
            </Block>
          )}

          <Block title={`📜 제출한 미션 (${submitted.length})`}>
            {submitted.length === 0 ? (
              <Empty>제출한 미션이 없어요.</Empty>
            ) : (
              <ul className="space-y-3">
                {submitted.map((m) => {
                  const sub = m.mySubmission!;
                  return (
                    <li key={m.slot} className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-ink">
                          #{m.slot} {m.title}
                        </b>
                        <Badge tone={SUBMISSION[sub.status].tone}>{SUBMISSION[sub.status].label}</Badge>
                      </div>
                      {sub.note && <p className="text-xs text-ink-soft break-words">“{sub.note}”</p>}
                      {sub.photoUrl && (
                        <a href={sub.photoUrl} target="_blank" rel="noopener noreferrer">
                          {/* 서명 URL 이라 next/image 최적화 대상이 아님 */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sub.photoUrl} alt={`미션 ${m.slot} 인증 사진`} className="max-h-40 rounded-xl border border-line object-cover" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>

          <Block title="💌 보낸 질문">
            {sentTarget.length + sentManito.length === 0 ? (
              <Empty>아직 보낸 질문이 없어요.</Empty>
            ) : (
              <div className="space-y-3">
                {[
                  { title: `💝 ${state.target?.name ?? "내가 섬기는 친구"} 님에게`, items: sentTarget },
                  { title: "🎭 비밀 마니또에게", items: sentManito },
                ]
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.title}>
                      <p className="mb-1 text-xs font-semibold text-ink-soft">{g.title}</p>
                      <ul className="space-y-2">
                        {g.items.map((it) => (
                          <li key={it.id} className="rounded-xl bg-surface-2 p-2.5 text-sm">
                            <p className="text-ink break-words">Q. {it.question}</p>
                            <p className={it.answer ? "mt-1 text-accent break-words" : "mt-1 text-xs text-ink-soft"}>
                              {it.answer ? `A. ${it.answer}` : "답장 기다리는 중…"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Block>

          <Block title={`🔮 AI 스무고개 질문 (${ask?.history.length ?? 0})`}>
            {!ask || ask.history.length === 0 ? (
              <Empty>아직 질문하지 않았어요.</Empty>
            ) : (
              <ul className="space-y-2">
                {ask.history.map((h, i) => (
                  <li key={`${h.createdAt}-${i}`} className="rounded-xl bg-surface-2 p-2.5 text-sm">
                    <p className="text-ink break-words">Q. {h.question}</p>
                    <p className="mt-1 text-xs text-ink-soft break-words">A. {h.answer}</p>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {quiz && (
            <p className="px-1 text-center text-xs text-ink-soft">
              🧠 TMI 퀴즈 {quiz.answered}문제 중 {quiz.score}문제 정답
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
