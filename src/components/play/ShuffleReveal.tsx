"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

interface Props {
  targetName: string;
  targetKeywords: { label: string; value: string }[];
  /** 슬롯머신에 돌 이름 후보 (나 제외 권장) */
  pool: string[];
  onDone: () => void;
}

const STEPS = 30; // 이름이 바뀌는 횟수. 간격은 점점 길어짐
const CONFETTI = ["🎉", "🎊", "✨", "💖", "🎁", "⭐"];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 게임 시작 직후 한 번: 마니또를 섞는 슬롯머신 → 내가 섬길 친구 공개 */
export function ShuffleReveal({
  targetName,
  targetKeywords,
  pool: poolProp,
  onDone,
}: Props) {
  // 5초 폴링으로 부모가 다시 렌더돼도 애니메이션이 처음부터 재시작되지 않도록 마운트 시점 값으로 고정
  const [pool] = useState(poolProp);
  const [phase, setPhase] = useState<"shuffle" | "reveal">(() =>
    prefersReducedMotion() ? "reveal" : "shuffle",
  );
  const [shown, setShown] = useState(targetName);

  useEffect(() => {
    if (phase !== "shuffle") return;
    const names = pool.length > 0 ? pool : [targetName];
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      step += 1;
      if (step >= STEPS) {
        setShown(targetName);
        timer = setTimeout(() => setPhase("reveal"), 650);
        return;
      }
      setShown(names[(step * 7 + Math.floor(step / 3)) % names.length]);
      // 60ms → 약 340ms 로 점점 느려짐 (멈추는 느낌)
      timer = setTimeout(tick, 60 + Math.pow(step / STEPS, 2.4) * 280);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [phase, pool, targetName]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="마니또 공개"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-bg/95 px-6 text-center backdrop-blur-sm"
    >
      {phase === "reveal" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {Array.from({ length: 26 }, (_, i) => (
            <span
              key={i}
              className="confetti-piece text-2xl"
              style={
                {
                  left: `${(i * 37) % 100}%`,
                  "--dx": `${((i % 5) - 2) * 40}px`,
                  "--rot": `${360 + (i % 4) * 180}deg`,
                  "--dur": `${3 + (i % 5) * 0.5}s`,
                  "--delay": `${(i % 9) * 0.12}s`,
                } as React.CSSProperties
              }
            >
              {CONFETTI[i % CONFETTI.length]}
            </span>
          ))}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center">
        {phase === "shuffle" ? (
          <>
            <p className="text-sm font-semibold text-ink-soft">
              🎲 마니또를 섞는 중…
            </p>
            <div className="mt-6 flex h-28 w-full max-w-xs items-center justify-center rounded-3xl border border-line bg-surface shadow-lg">
              <span className="shuffle-flicker text-4xl font-extrabold tracking-tight text-brand">
                {shown}
              </span>
            </div>
            <p className="mt-6 text-xs text-ink-soft">
              내가 몰래 섬길 친구는 누구일까요?
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink-soft">
              당신이 몰래 섬길 친구는
            </p>
            <div className="reveal-pop reveal-glow mt-4 rounded-3xl bg-brand px-8 py-6 shadow-xl">
              <span className="text-4xl font-extrabold tracking-tight text-brand-ink">
                {targetName}
              </span>
              <span className="ml-1 text-xl font-bold text-brand-ink/90">
                님!
              </span>
            </div>

            {targetKeywords.length > 0 && (
              <ul className="mt-6 flex max-w-xs flex-wrap justify-center gap-2">
                {targetKeywords.map((k) => (
                  <li
                    key={k.label}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs"
                  >
                    <span className="text-ink-soft">{k.label}</span>{" "}
                    <b className="text-ink">{k.value}</b>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-6 max-w-xs text-xs leading-relaxed text-ink-soft">
              🎭 그리고 나를 몰래 섬기는 비밀 마니또는…{" "}
              <b className="text-ink">???</b>
              <br />
              미션과 퀴즈로 힌트를 모아 맞혀 보세요!
            </p>
            <Button type="button" onClick={onDone} className="mt-8 min-w-48">
              시작하기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
