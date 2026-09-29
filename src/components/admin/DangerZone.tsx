"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Button, Card, ErrorText, Input, SectionTitle } from "@/components/ui";

interface DangerZoneProps {
  onRefresh: () => Promise<void>;
}

export function DangerZone({ onRefresh }: DangerZoneProps) {
  const [resetInput, setResetInput] = useState("");
  const [keepParticipants, setKeepParticipants] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const canProceed = resetInput.trim() === "RESET";

  const handleReset = async () => {
    if (!canProceed) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await api("/api/admin/session", {
        action: "reset",
        confirm: "RESET",
        keepParticipants,
      });
      setResetInput("");
      setConfirmStep(false);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("세션 리셋 요청에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 border-danger/30 bg-danger/5">
      <SectionTitle
        right={
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
            위험 구역
          </span>
        }
      >
        세션 초기화 (Danger Zone)
      </SectionTitle>

      <div className="flex flex-col gap-3 text-xs leading-relaxed text-ink-soft">
        <p>
          ⚠️ 세션 데이터를 초기화합니다. 리허설 후 본 게임을 시작하거나 긴급 초기화가 필요할 때만 사용하세요.
        </p>

        <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-ink select-none cursor-pointer">
          <input
            type="checkbox"
            checked={keepParticipants}
            onChange={(e) => setKeepParticipants(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded accent-brand"
          />
          <span className="font-semibold text-xs text-ink">
            참가자 명단 유지 (keepParticipants)
          </span>
          <span className="text-[11px] text-ink-soft">
            {keepParticipants
              ? "— 참가자 계정은 보존되고 매칭·미션·배팅만 초기화"
              : "— 참가자 명단까지 모두 삭제"}
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-confirm-text" className="font-semibold text-ink">
            초기화를 진행하려면 아래에 <span className="font-mono text-danger font-bold">RESET</span> 을 입력하세요:
          </label>
          <Input
            id="reset-confirm-text"
            type="text"
            placeholder="RESET"
            value={resetInput}
            onChange={(e) => setResetInput(e.target.value)}
            disabled={loading}
            className="font-mono text-sm tracking-wider"
          />
        </div>
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      {confirmStep ? (
        <div className="flex flex-col gap-2 rounded-xl border border-danger bg-danger/10 p-3">
          <p className="text-xs font-bold text-danger">
            정말로 모든 게임 세션을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              loading={loading}
              onClick={handleReset}
              className="flex-1 text-xs"
            >
              초기화 실행 ⚠️
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => setConfirmStep(false)}
              className="flex-1 text-xs"
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="danger"
          disabled={!canProceed || loading}
          onClick={() => setConfirmStep(true)}
          className="w-full text-xs"
        >
          세션 초기화 진행
        </Button>
      )}
    </Card>
  );
}
