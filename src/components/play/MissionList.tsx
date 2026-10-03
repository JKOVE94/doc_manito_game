"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, formatClock, Input } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/client/api";
import { uploadMissionPhoto } from "@/lib/client/upload";
import type { MissionView, TargetView } from "@/lib/types";

interface MissionListProps {
  missions: MissionView[];
  target: TargetView | null;
  clockOffsetMs: number;
  refresh: () => Promise<void>;
}

export function MissionList({
  missions,
  target,
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
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [previews, setPreviews] = useState<Record<number, string | null>>({});
  const [submittingStep, setSubmittingStep] = useState<Record<number, "photo" | "submitting" | null>>({});
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previews]);

  // Sort descending: highest slot first (latest on top)
  const sortedMissions = [...missions].sort((a, b) => b.slot - a.slot);

  const handleFileChange = (slot: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMap((prev) => ({ ...prev, [slot]: "이미지 파일만 선택할 수 있어요." }));
      return;
    }
    setErrorMap((prev) => ({ ...prev, [slot]: "" }));
    setFiles((prev) => ({ ...prev, [slot]: file }));
    const objectUrl = URL.createObjectURL(file);
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: objectUrl };
    });
  };

  const handleRemoveFile = (slot: number) => {
    setFiles((prev) => ({ ...prev, [slot]: null }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: null };
    });
  };

  const handleSubmitMission = async (slot: number) => {
    const note = (notes[slot] ?? "").trim();
    const file = files[slot] ?? null;

    if (!note && !file) {
      setErrorMap((prev) => ({
        ...prev,
        [slot]: "사진 또는 메모 중 하나 이상을 입력해 주세요.",
      }));
      return;
    }

    setErrorMap((prev) => ({ ...prev, [slot]: "" }));

    try {
      let photoPath: string | undefined;
      if (file) {
        setSubmittingStep((prev) => ({ ...prev, [slot]: "photo" }));
        photoPath = await uploadMissionPhoto(file);
      }

      setSubmittingStep((prev) => ({ ...prev, [slot]: "submitting" }));
      await api("/api/me/mission", {
        slot,
        note: note || undefined,
        photoPath,
      });

      // Clear form
      setNotes((prev) => ({ ...prev, [slot]: "" }));
      handleRemoveFile(slot);
      await refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMap((prev) => ({ ...prev, [slot]: err.message }));
      } else if (err instanceof Error) {
        setErrorMap((prev) => ({ ...prev, [slot]: err.message }));
      } else {
        setErrorMap((prev) => ({
          ...prev,
          [slot]: "미션 제출에 실패했습니다. 다시 시도해 주세요.",
        }));
      }
    } finally {
      setSubmittingStep((prev) => ({ ...prev, [slot]: null }));
    }
  };

  const targetName = target ? target.name : "친구";

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
      {/* Target Mission Header */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
          <span>💝</span>
          <span>→ {targetName} 님을 위한 미션</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-soft">
          미션을 수행하고 인증 사진이나 메모를 남겨 섬김을 실천해 보세요!
        </p>
      </div>

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

        const step = submittingStep[mission.slot] ?? null;
        const isSubmitting = step !== null;
        const currentPreview = previews[mission.slot] ?? null;

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
              <div className="rounded-xl bg-surface-2 p-3 text-xs text-ink-soft">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">내 제출 내용</span>
                  <span className="text-[11px]">
                    {isApproved
                      ? "승인 완료됨"
                      : isPending
                        ? "호스트 승인 대기 중"
                        : "반려됨 — 재작성 가능"}
                  </span>
                </div>

                {submission.photoUrl && (
                  <div className="mt-2.5">
                    <span className="text-[11px] text-ink-soft">
                      인증 사진 (탭하여 확대):
                    </span>
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto(submission.photoUrl)}
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={submission.photoUrl}
                          alt="미션 인증 사진"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100 text-[10px] font-bold text-white">
                          확대 🔍
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {submission.note ? (
                  <p className="mt-2 text-ink break-words">
                    &quot;{submission.note}&quot;
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] italic text-ink-soft">
                    (메모 없이 사진으로 제출함)
                  </p>
                )}
              </div>
            )}

            {/* Submission Form (Active and Not Approved) */}
            {mission.isActive && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitMission(mission.slot);
                }}
                className="mt-1 flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">
                    {isRejected ? "미션 다시 보고하기" : "미션 완료 보고"}
                  </span>
                  <span className="text-[11px] text-ink-soft">
                    사진 또는 메모 필수
                  </span>
                </div>

                {/* 📷 Photo Selection */}
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id={`file-input-${mission.slot}`}
                    className="hidden"
                    onChange={(e) => handleFileChange(mission.slot, e)}
                    disabled={isSubmitting}
                  />

                  {currentPreview ? (
                    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentPreview}
                          alt="선택된 사진 미리보기"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col items-start gap-1 min-w-0">
                        <span className="truncate text-xs font-medium text-ink">
                          {files[mission.slot]?.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(mission.slot)}
                          disabled={isSubmitting}
                          className="text-xs font-semibold text-danger hover:underline"
                        >
                          사진 제거 ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor={`file-input-${mission.slot}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line border-dashed bg-surface px-4 text-xs font-semibold text-ink cursor-pointer hover:bg-surface-2 transition active:scale-[0.99]"
                    >
                      <span className="text-base" aria-hidden="true">
                        📷
                      </span>
                      <span>인증 사진 첨부하기</span>
                    </label>
                  )}
                </div>

                {/* Note input */}
                <Input
                  id={`mission-note-${mission.slot}`}
                  type="text"
                  placeholder="메모 (사진 첨부 시 선택, 사진 없으면 필수)"
                  maxLength={100}
                  value={notes[mission.slot] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({
                      ...prev,
                      [mission.slot]: e.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                  className="text-sm"
                />

                <ErrorText>{errorMap[mission.slot]}</ErrorText>

                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {step === "photo"
                    ? "사진 올리는 중…"
                    : step === "submitting"
                      ? "보고 제출 중…"
                      : isRejected
                        ? "수정하여 재제출하기"
                        : "완료 보고 제출"}
                </Button>
              </form>
            )}
          </Card>
        );
      })}

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
        >
          <div
            className="relative flex max-h-[85vh] max-w-sm flex-col items-center overflow-hidden rounded-2xl bg-surface p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto}
              alt="확대된 인증 사진"
              className="max-h-[75vh] w-auto rounded-xl object-contain"
            />
            <Button
              variant="secondary"
              onClick={() => setLightboxPhoto(null)}
              className="mt-2 w-full text-xs"
            >
              닫기 ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
