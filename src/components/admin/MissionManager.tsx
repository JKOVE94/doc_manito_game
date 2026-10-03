"use client";

import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, formatClock, Input, SectionTitle } from "@/components/ui";
import type { AdminMissionRow } from "@/lib/types";
import { MissionAutoControl } from "./MissionAutoControl";

interface MissionManagerProps {
  missions: AdminMissionRow[];
  auto: { enabled: boolean; nextAt: string | null; sessionActive: boolean };
  clockOffsetMs: number;
  onRefresh: () => Promise<void>;
}

export function MissionManager({
  missions,
  auto,
  clockOffsetMs,
  onRefresh,
}: MissionManagerProps) {
  // Ensure we display all 8 slots (1 to 8)
  const fullMissions: AdminMissionRow[] = Array.from({ length: 8 }, (_, idx) => {
    const slot = idx + 1;
    const found = missions.find((m) => m.slot === slot);
    return (
      found ?? {
        slot,
        title: "",
        description: "",
        openedAt: null,
        deadline: null,
      }
    );
  });

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          <span className="text-xs text-ink-soft">
            총 8개 미션 슬롯
          </span>
        }
      >
        미션 관리
      </SectionTitle>

      <MissionAutoControl
        enabled={auto.enabled}
        nextAt={auto.nextAt}
        sessionActive={auto.sessionActive}
        clockOffsetMs={clockOffsetMs}
        onRefresh={onRefresh}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fullMissions.map((mission) => (
          <MissionSlotCard
            key={`${mission.slot}-${mission.title}-${mission.description}-${mission.openedAt}-${mission.deadline}`}
            mission={mission}
            clockOffsetMs={clockOffsetMs}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </Card>
  );
}

function MissionSlotCard({
  mission,
  clockOffsetMs,
  onRefresh,
}: {
  mission: AdminMissionRow;
  clockOffsetMs: number;
  onRefresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(mission.title);
  const [description, setDescription] = useState(mission.description);
  const [durationMin, setDurationMin] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!mission.openedAt || !mission.deadline) {
      return;
    }

    const targetMs = new Date(mission.deadline).getTime();
    const updateCountdown = () => {
      const curNow = Date.now() + clockOffsetMs;
      setSecondsRemaining(Math.max(0, Math.ceil((targetMs - curNow) / 1000)));
    };

    const timerId = setTimeout(updateCountdown, 0);
    const intervalId = setInterval(updateCountdown, 1000);

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [mission.openedAt, mission.deadline, clockOffsetMs]);

  const isOpened = mission.openedAt !== null;
  const isClosed = isOpened && mission.deadline !== null && secondsRemaining === 0;
  const isActive = isOpened && !isClosed;

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/mission/save", {
        slot: mission.slot,
        title: title.trim(),
        description: description.trim(),
      });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("미션 저장에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/mission/open", {
        slot: mission.slot,
        durationMin: Math.max(1, durationMin),
      });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("미션 오픈에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/mission/close", {
        slot: mission.slot,
      });
      setConfirmClose(false);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("미션 마감에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink">
          슬롯 #{mission.slot}
        </span>
        {isActive ? (
          <Badge tone="accent">
            진행중 {secondsRemaining !== null && `(${formatClock(secondsRemaining)})`}
          </Badge>
        ) : isClosed ? (
          <Badge tone="danger">마감됨</Badge>
        ) : (
          <Badge tone="neutral">미오픈</Badge>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Input
          placeholder="미션 제목 (예: 마니또에게 응원 쪽지 남기기)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="text-sm"
        />
        <textarea
          rows={2}
          placeholder="미션 설명 (수행 방법, 팁 등)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-brand"
        />
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      <div className="flex flex-col gap-2 pt-1 border-t border-line/50">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={loading}
            onClick={handleSave}
            className="min-h-9 px-3 py-1 text-xs"
          >
            내용 저장 💾
          </Button>

          {isActive && (
            confirmClose ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-danger font-semibold">마감?</span>
                <Button
                  type="button"
                  variant="danger"
                  loading={loading}
                  onClick={handleClose}
                  className="min-h-9 px-2.5 py-1 text-xs"
                >
                  확인
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setConfirmClose(false)}
                  className="min-h-9 px-2 py-1 text-xs"
                >
                  취소
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                loading={loading}
                onClick={() => setConfirmClose(true)}
                className="min-h-9 px-3 py-1 text-xs"
              >
                즉시 마감 ⏹
              </Button>
            )
          )}
        </div>

        {/* Open Controls if not active */}
        {!isActive && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1 text-xs text-ink-soft">
              <span>진행(분):</span>
              <Input
                type="number"
                min={1}
                max={300}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, parseInt(e.target.value) || 1))}
                className="min-h-9 w-16 px-1.5 py-1 text-center text-xs font-semibold"
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={handleOpen}
              className="min-h-9 flex-1 px-3 py-1 text-xs"
            >
              {isClosed ? "미션 재오픈 🔓" : "미션 오픈 🚀"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
