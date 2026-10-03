"use client";

import { Card } from "@/components/ui";
import type { TargetView } from "@/lib/types";

interface TargetCardProps {
  target: TargetView;
}

export function TargetCard({ target }: TargetCardProps) {
  return (
    <Card className="relative overflow-hidden border-brand/20 bg-linear-to-b from-brand/10 via-surface to-surface shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
          <span>💝</span> 내가 섬기는 친구
        </span>
        <span className="text-xs font-medium text-ink-soft">이름 공개</span>
      </div>

      <div className="my-4 text-center">
        <div className="mb-1 text-3xl font-black tracking-tight text-ink">
          {target.name} 님
        </div>
        <p className="text-xs font-semibold text-brand">
          미션으로 이 친구를 몰래 섬겨 주세요!
        </p>
      </div>

      {/* 3 Keyword Chips (label: value) */}
      <div className="mt-3 flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-soft">
          친구를 알아가는 키워드
        </span>
        <div className="flex flex-col gap-2">
          {target.keywords.map((kw) => (
            <div
              key={kw.slot}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/70 px-3.5 py-2.5"
            >
              <span className="shrink-0 text-xs font-semibold text-ink-soft">
                #{kw.slot} {kw.label}
              </span>
              <span className="text-right text-sm font-bold text-ink break-words">
                {kw.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
