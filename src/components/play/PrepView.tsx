"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorText, Input, SectionTitle } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { ParticipantState } from "@/lib/types";

interface PrepViewProps {
  state: ParticipantState;
  refresh: () => Promise<void>;
}

const MIN_PARTICIPANTS = 4;

/** 게임 시작 전: 나에 대한 키워드 3개 입력 → [준비 완료]. 호스트가 전원 준비를 확인하고 시작해요. */
export function PrepView({ state, refresh }: PrepViewProps) {
  const { participantCount, readyCount } = state.session;
  const isReady = state.me.isReady;

  const savedValues = [1, 2, 3].map((slot) => state.me.keywords.find((k) => k.slot === slot)?.value ?? "");
  const [values, setValues] = useState<string[]>(savedValues);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = values.map((v) => v.trim());
  const allFilled = trimmed.every((v) => v.length >= 1 && v.length <= 30);
  const dirty = trimmed.some((v, i) => v !== savedValues[i]);
  const labelFor = (slot: number) => state.keywordSlots.find((s) => s.slot === slot)?.label ?? `키워드 #${slot}`;

  const fail = (e: unknown, fallback: string) => setError(e instanceof ApiRequestError ? e.message : fallback);

  /** 변경된 키워드가 있으면 먼저 저장한 뒤 준비 완료 */
  const handleReady = async () => {
    setError(null);
    if (!allFilled) return setError("키워드 3개를 모두 입력해 주세요. (각 30자 이하)");
    setToggling(true);
    try {
      if (dirty || state.me.keywords.length < 3) {
        setSaving(true);
        await api("/api/me/keywords", { keywords: trimmed });
        setSaving(false);
      }
      await api("/api/me/ready", { ready: true });
      await refresh();
    } catch (e) {
      fail(e, "준비 처리에 실패했어요.");
    } finally {
      setSaving(false);
      setToggling(false);
    }
  };

  const handleCancelReady = async () => {
    setError(null);
    setToggling(true);
    try {
      await api("/api/me/ready", { ready: false });
      await refresh();
    } catch (e) {
      fail(e, "준비 취소에 실패했어요.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-brand/30 bg-brand/5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink">🙋 준비 현황</p>
            <p className="mt-0.5 text-xs text-ink-soft">모두 준비되면 호스트가 게임을 시작해요</p>
          </div>
          <Badge tone={readyCount === participantCount && participantCount >= MIN_PARTICIPANTS ? "accent" : "brand"}>
            준비 {readyCount}/{participantCount}명
          </Badge>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${participantCount ? Math.round((readyCount / participantCount) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          {participantCount < MIN_PARTICIPANTS
            ? `최소 ${MIN_PARTICIPANTS}명이 필요해요 (현재 ${participantCount}명)`
            : readyCount === participantCount
              ? "전원 준비 완료! 호스트의 시작을 기다리는 중…"
              : `${participantCount - readyCount}명이 아직 준비 중이에요`}
        </p>
      </Card>

      <Card>
        <SectionTitle
          right={isReady ? <Badge tone="accent">준비 완료 ✅</Badge> : <Badge tone="neutral">작성 중</Badge>}
        >
          ✍️ 나를 소개하는 키워드 3개
        </SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-ink-soft">
          나를 섬기는 비밀 마니또가 미션을 하면 이 키워드가 하나씩 공개돼요. 너무 뻔하지 않게, 그래도 나다운 걸로!
        </p>
        <div className="flex flex-col gap-3">
          {values.map((v, i) => (
            <div key={i}>
              <label htmlFor={`kw-${i}`} className="mb-1 block text-xs font-semibold text-ink-soft">
                #{i + 1} {labelFor(i + 1)}
              </label>
              <Input
                id={`kw-${i}`}
                value={v}
                maxLength={30}
                disabled={isReady || toggling}
                placeholder={["예: 수영선수 출신", "예: 요즘 빠진 취미", "예: 기타 연주"][i]}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  setValues(next);
                  if (error) setError(null);
                }}
              />
            </div>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>

        {isReady ? (
          <div className="mt-4 flex flex-col gap-2">
            <p className="rounded-xl bg-accent/10 p-3 text-center text-sm font-semibold text-accent">
              준비 완료! 다른 친구들을 기다리고 있어요 🙌
            </p>
            <Button type="button" variant="secondary" loading={toggling} onClick={handleCancelReady}>
              준비 취소하고 수정하기
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="mt-4 w-full"
            loading={toggling}
            disabled={!allFilled || toggling}
            onClick={handleReady}
          >
            {saving ? "저장 중…" : "✅ 준비 완료"}
          </Button>
        )}
      </Card>

      <p className="px-1 text-center text-[11px] leading-relaxed text-ink-soft">
        🤫 거짓·진실 게임의 &lsquo;거짓말 순번&rsquo;은 지금 정하지 않아도 돼요. 게임이 시작된 뒤 거짓·진실 탭에서 정하면 됩니다.
      </p>
    </div>
  );
}
