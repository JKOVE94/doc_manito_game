"use client";

import { useState } from "react";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import type { EndingView as EndingViewType } from "@/lib/types";
import { ChainRing } from "./ChainRing";

interface EndingViewProps {
  ending: EndingViewType;
  myId: string;
}

export function EndingView({ ending, myId }: EndingViewProps) {
  // Drumroll secret reveal state
  const [drumrolling, setDrumrolling] = useState(false);
  const [secretRevealed, setSecretRevealed] = useState(false);

  const handleStartDrumroll = () => {
    setDrumrolling(true);
    setTimeout(() => {
      setDrumrolling(false);
      setSecretRevealed(true);
    }, 1600);
  };

  const secretManitoName = ending.mySecretManito?.name ?? "알 수 없음";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 나의 비밀 마니또 공개 카드 (드럼롤 인터랙션) */}
      <Card className="relative overflow-hidden border-brand/40 bg-linear-to-b from-brand/15 via-surface to-surface text-center shadow-md">
        <div className="mb-2">
          <Badge tone="brand">마니또 최종 공개</Badge>
        </div>

        <h3 className="text-xl font-black text-ink">
          나의 비밀 마니또는 누구였을까요?
        </h3>
        <p className="mt-1 text-xs text-ink-soft">
          파티 동안 나 몰래 미션을 수행하며 나를 섬겨준 천사를 확인하세요!
        </p>

        <div className="my-5">
          {!secretRevealed ? (
            <div
              className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-2/60 p-6 ${
                drumrolling ? "animate-pulse scale-105 transition-transform" : ""
              }`}
            >
              <div
                className={`text-5xl ${drumrolling ? "animate-bounce" : ""}`}
                aria-hidden="true"
              >
                🥁
              </div>
              <p className="mt-3 text-sm font-bold text-ink">
                {drumrolling
                  ? "두구두구두구… 발표 1초 전!"
                  : "궁금하다면 아래 버튼을 눌러보세요!"}
              </p>

              <Button
                variant="primary"
                onClick={handleStartDrumroll}
                loading={drumrolling}
                disabled={drumrolling}
                className="mt-4 w-full max-w-xs shadow-md"
              >
                {drumrolling ? "공개하는 중…" : "내 비밀 마니또 확인하기 🎁"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 p-6 animate-fadeIn">
              <div className="text-5xl animate-bounce" aria-hidden="true">
                🎉
              </div>
              <span className="mt-2 text-xs font-semibold text-accent">
                나를 섬겨준 마니또는 바로…
              </span>
              <div className="mt-1 text-3xl font-black tracking-tight text-ink">
                {secretManitoName} 님! 💖
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                파티 동안 따뜻한 섬김을 베풀어주셔서 감사합니다!
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* 2. 순환 고리 시각화 애니메이션 */}
      <Card>
        <SectionTitle>⭕ 마니또 순환 고리</SectionTitle>
        <p className="mb-4 text-xs leading-relaxed text-ink-soft">
          모든 참가자가 서로를 섬기는 단 하나의 아름다운 원형 고리(Hamiltonian Cycle)가 완성되었습니다.
        </p>

        <ChainRing chain={ending.chain} myId={myId} />
      </Card>

      {/* 3. 베스트 마니또 🏆 */}
      {ending.bestManitos.length > 0 && (
        <Card className="border-warn/40 bg-linear-to-b from-warn/15 to-surface shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warn/20 text-2xl" aria-hidden="true">
              🏆
            </div>
            <div>
              <Badge tone="warn">베스트 마니또</Badge>
              <h4 className="mt-1 text-lg font-bold text-ink">
                {ending.bestManitos.map((b) => b.name).join(", ")} 님
              </h4>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            승인된 미션을 가장 많이 달성하고 섬김을 성실히 실천한 이번 파티의 최고의 마니또입니다! 모두 축하해주세요! 👏
          </p>
        </Card>
      )}

      {/* 4. 전체 결과 표 */}
      <Card>
        <SectionTitle>📊 전체 마니또 매칭 & 결과 표</SectionTitle>
        <p className="mb-3 text-xs text-ink-soft">
          각 참가자가 섬긴 대상, 승인된 미션 수, 그리고 최종 추리 결과입니다.
        </p>

        {/* Scrollable table container */}
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-2 font-semibold text-ink-soft">
              <tr>
                <th className="px-3 py-2.5">섬긴 사람</th>
                <th className="px-3 py-2.5">타깃</th>
                <th className="px-2 py-2.5 text-center">승인 미션</th>
                <th className="px-3 py-2.5 text-center">추리 결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 bg-surface">
              {ending.chain.map((link) => {
                const isMe = link.giver.id === myId;
                const isCorrect = link.guessCorrect === true;
                const isIncorrect = link.guessCorrect === false;

                return (
                  <tr
                    key={link.position}
                    className={`transition hover:bg-surface-2/40 ${
                      isMe ? "bg-brand/5 font-semibold" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink">{link.giver.name}</span>
                        {isMe && (
                          <span className="rounded bg-brand px-1 py-0.5 text-[10px] text-brand-ink">
                            나
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span className="font-bold text-ink">
                        {link.receiver.name}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-2 py-3 text-center">
                      <span className="font-bold text-accent">
                        {link.approvedMissions}개
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      {isCorrect ? (
                        <Badge tone="accent">맞춤 ✅</Badge>
                      ) : isIncorrect ? (
                        <Badge tone="danger">틀림 ❌</Badge>
                      ) : (
                        <Badge tone="neutral">미제출</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
