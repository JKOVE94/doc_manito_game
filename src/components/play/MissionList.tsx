"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, formatClock, Input } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import type { MissionView } from "@/lib/types";

interface MissionListProps {
  missions: MissionView[];
  clockOffsetMs: number;
  refresh: () => Promise<void>;
}

export function MissionList({
  missions,
  clockOffsetMs,
  refresh,
}: MissionListProps) {
  // Ticking state for deadlines
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + clockOffsetMs);
    }, 1000);
    return () => clearInterval(timer);
  }, [clockOffsetMs]);

  // Form states per slot
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [submittingSlot, setSubmittingSlot] = useState<number | null>(null);
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});

  // Sort descending: highest slot first (latest on top)
  const sortedMissions = [...missions].sort((a, b) => b.slot - a.slot);

  const handleSubmitMission = async (slot: number) => {
    const note = (notes[slot] ?? "").trim();
    setSubmittingSlot(slot);
    setErrorMap((prev) => ({ ...prev, [slot]: "" }));

    try {
      await api("/api/me/mission", { slot, note });
      // Clear note
      setNotes((prev) => ({ ...prev, [slot]: "" }));
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMap((prev) => ({ ...prev, [slot]: err.message }));
      } else {
        setErrorMap((prev) => ({
          ...prev,
          [slot]: "미션 제출에 실패했습니다. 다시 시도해주세요.",
        }));
      }
    } finally {
      setSubmittingSlot(null);
    }
  };

  if (sortedMissions.length === 0) {
    return (
      <Card className="py-12 text-center text-ink-soft">
        <span className="text-4xl" aria-hidden="true">
          📭
        </span>
        <h3 className="mt-3 text-base font-bold text-ink">
          아직 오픈된 미션이 없습니다
        </h3>
        <p className="mt-1 text-xs">
          관리자가 미션을 오픈하면 여기에 실시간으로 표시됩니다.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedMissions.map((mission) => {
        const submission = mission.mySubmission;
        const isApproved = submission?.status === "APPROVED";
        const isPending = submission?.status === "PENDING";
        const isRejected = submission?.status === "REJECTED";

        // Deadline calculation
        let deadlineLabel: string | null = null;
        let isExpired = false;

        if (mission.deadline) {
          const deadlineTime = new Date(mission.deadline).getTime();
          const diffMs = deadlineTime - now;
          if (diffMs <= 0) {
            isExpired = true;
            deadlineLabel = "마감됨";
          } else {
            const totalSec = Math.floor(diffMs / 1000);
            if (totalSec >= 3600) {
              const h = Math.floor(totalSec / 3600);
              const m = Math.floor((totalSec % 3600) / 60);
              deadlineLabel = `${h}시간 ${m}분 남음`;
            } else {
              deadlineLabel = `${formatClock(totalSec)} 남음`;
            }
          }
        }

        return (
          <Card
            key={mission.slot}
            className={`flex flex-col gap-3 transition ${
              mission.isActive
                ? "border-brand/40 shadow-sm"
                : "border-line bg-surface/90"
            }`}
          >
            {/* Header: Slot + Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">
                  #{mission.slot}
                </span>
                <h3 className="text-base font-bold text-ink">
                  {mission.title}
                </h3>
              </div>

              {/* Status Badge */}
              <div>
                {isApproved ? (
                  <Badge tone="accent">승인 ✅</Badge>
                ) : isPending ? (
                  <Badge tone="warn">검토중 ⏳</Badge>
                ) : isRejected ? (
                  <Badge tone="danger">반려 ❌ (재제출 가능)</Badge>
                ) : (
                  <Badge tone="neutral">미제출</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-xs leading-relaxed text-ink-soft">
              {mission.description}
            </p>

            {/* Deadline status */}
            {deadlineLabel && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-ink-soft">마감 시간:</span>
                <span
                  className={`font-semibold ${
                    isExpired ? "text-ink-soft" : "text-brand"
                  }`}
                >
                  ⏱️ {deadlineLabel}
                </span>
              </div>
            )}

            {/* Existing submission info */}
            {submission && (
              <div className="rounded-xl bg-surface-2 p-2.5 text-xs text-ink-soft">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">내가 제출한 메모</span>
                  <span className="text-[11px]">
                    {isApproved
                      ? "승인 완료됨"
                      : isPending
                        ? "호스트 승인 대기 중"
                        : "반려됨 — 재작성 가능"}
                  </span>
                </div>
                <p className="mt-1 text-ink">
                  {submission.note ? `"${submission.note}"` : "(메모 없이 제출함)"}
                </p>
              </div>
            )}

            {/* Submission Form (Active and Not Approved) */}
            {mission.isActive && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitMission(mission.slot);
                }}
                className="mt-1 flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-3"
              >
                <label
                  htmlFor={`mission-note-${mission.slot}`}
                  className="text-xs font-semibold text-ink"
                >
                  {isRejected ? "미션 다시 보고하기" : "미션 완료 보고"}
                </label>
                <Input
                  id={`mission-note-${mission.slot}`}
                  type="text"
                  placeholder="한 줄 메모 (선택사항, 최대 100자)"
                  maxLength={100}
                  value={notes[mission.slot] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      [mission.slot]: e.target.value,
                    }))
                  }
                  disabled={submittingSlot === mission.slot}
                />

                <ErrorText>{errorMap[mission.slot]}</ErrorText>

                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingSlot === mission.slot}
                  disabled={submittingSlot === mission.slot}
                  className="w-full"
                >
                  {isRejected ? "수정하여 재제출하기" : "완료 보고 제출"}
                </Button>
              </form>
            )}
          </Card>
        );
      })}
    </div>
  );
}
