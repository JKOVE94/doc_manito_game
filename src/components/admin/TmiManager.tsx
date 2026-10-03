"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { AdminState, SessionStatus } from "@/lib/types";

interface TmiManagerProps {
  tmi: AdminState["tmi"];
  quiz: AdminState["quiz"];
  sessionStatus: SessionStatus;
  onRefresh: () => Promise<void>;
}

export function TmiManager({
  tmi,
  quiz,
  sessionStatus,
  onRefresh,
}: TmiManagerProps) {
  const [text, setText] = useState("");
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [sendLoading, setSendLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizSuccessMsg, setQuizSuccessMsg] = useState<string | null>(null);

  const handleSaveTmi = async () => {
    if (!text.trim()) {
      setSaveError("TMI 데이터를 입력해주세요.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await api<{ ok: true; factCount: number }>("/api/admin/tmi", {
        text,
      });
      setSaveSuccessMsg(`TMI ${res.factCount}개가 저장되었습니다.`);
      setConfirmingSave(false);
      setText("");
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSaveError(err.message);
      } else {
        setSaveError("TMI 저장에 실패했습니다.");
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const [presetLoading, setPresetLoading] = useState(false);
  const [confirmingPreset, setConfirmingPreset] = useState(false);

  const handleLoadPreset = async () => {
    setPresetLoading(true);
    setSaveError(null);
    setSaveSuccessMsg(null);
    try {
      const res = await api<{ ok: true; factCount: number; quizCount: number }>("/api/admin/tmi", { preset: "notion" });
      setSaveSuccessMsg(`Notion TMI ${res.factCount}개(빈칸 퀴즈 ${res.quizCount}개)를 불러왔어요.`);
      setConfirmingPreset(false);
      await onRefresh();
    } catch (err) {
      setSaveError(err instanceof ApiRequestError ? err.message : "불러오기에 실패했습니다.");
    } finally {
      setPresetLoading(false);
    }
  };

  const handleSendQuiz = async () => {
    setSendLoading(true);
    setQuizError(null);
    setQuizSuccessMsg(null);

    try {
      await api<{ ok: true }>("/api/admin/quiz", { action: "send-now" });
      setQuizSuccessMsg("전원에게 퀴즈가 발송되었습니다.");
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setQuizError(err.message);
      } else {
        setQuizError("퀴즈 발송에 실패했습니다.");
      }
    } finally {
      setSendLoading(false);
    }
  };

  const isActive = sessionStatus === "ACTIVE";

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          <Badge tone={tmi.factCount > 0 ? "accent" : "neutral"}>
            총 {tmi.factCount}개 · 빈칸 {tmi.quizCount}개
          </Badge>
        }
      >
        📚 TMI 퀴즈 데이터
      </SectionTitle>

      {/* 1. 퀴즈 현황 & 즉시 발송 */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink">📊 퀴즈 진행 현황</span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-soft">
              대기: <strong className="text-warn">{quiz.pendingCount}명</strong>
            </span>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft">
              응답: <strong className="text-ink">{quiz.answeredCount}건</strong>
            </span>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft">
              정답: <strong className="text-accent">{quiz.correctCount}건</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/60">
          <p className="text-xs text-ink-soft">
            {isActive
              ? "대기 중 퀴즈가 없는 참가자 전원에게 즉시 새 퀴즈를 전송합니다."
              : "게임이 시작(ACTIVE)된 상태에서만 퀴즈를 보낼 수 있습니다."}
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={!isActive || sendLoading}
            loading={sendLoading}
            onClick={handleSendQuiz}
            className="min-h-9 px-3 text-xs"
          >
            🧠 지금 전원에게 퀴즈 보내기
          </Button>
        </div>

        <ErrorText>{quizError}</ErrorText>
        {quizSuccessMsg && (
          <p className="text-xs font-semibold text-accent">{quizSuccessMsg}</p>
        )}
      </div>

      {/* 2. 등록된 TMI 이름별 목록 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink">참가자별 TMI 등록 현황</span>
          <span className="text-[11px] text-ink-soft">
            {tmi.subjects.length}명 등록됨
          </span>
        </div>

        {tmi.subjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-ink-soft">
            등록된 TMI 데이터가 없습니다. 아래 입력창에서 추가해주세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {tmi.subjects.map((sub) => (
              <div
                key={sub.name}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs"
              >
                <span className="font-semibold text-ink">{sub.name}</span>
                <span className="text-ink-soft">({sub.count}개)</span>
                {!sub.matched && (
                  <Badge tone="warn">참가자 이름과 불일치 — 퀴즈 제외</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2.5 Notion TMI 프리셋 */}
      <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
        <p className="text-sm font-bold text-ink">📥 Notion TMI 불러오기</p>
        <p className="text-xs leading-relaxed text-ink-soft break-keep">
          전제니·오아영·이용준·김대현·김윤진·권순웅 6명, TMI 54개 (빈칸 퀴즈 포함, &lsquo;최근·어제·오늘&rsquo; 등 시점 정보 제거본).
          현재 TMI 는 모두 교체돼요. 참가자 이름이 위 이름과 같아야 퀴즈에 나와요.
        </p>
        {confirmingPreset ? (
          <div className="flex gap-2">
            <Button type="button" onClick={handleLoadPreset} loading={presetLoading} className="flex-1">
              교체하고 불러오기
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmingPreset(false)} disabled={presetLoading}>
              취소
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={() => setConfirmingPreset(true)}>
            📥 Notion TMI 54개 불러오기
          </Button>
        )}
      </div>

      {/* 3. TMI 전체 교체 입력창 */}
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <label htmlFor="tmi-input" className="text-xs font-bold text-ink">
          TMI 데이터 전체 교체
        </label>
        <p className="text-xs text-ink-soft leading-relaxed break-keep">
          형식 안내: JSON <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">[&#123;&quot;name&quot;:&quot;홍길동&quot;,&quot;fact&quot;:&quot;...&quot;&#125;]</code> 또는 줄마다 <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">이름: TMI</code> (줄바꿈 구분, <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">이름 | TMI</code>나 탭 구분도 가능)
        </p>

        <textarea
          id="tmi-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (saveError) setSaveError(null);
            if (saveSuccessMsg) setSaveSuccessMsg(null);
          }}
          disabled={saveLoading}
          rows={5}
          placeholder={`홍길동: 주말마다 등산을 감\n김철수: 고양이를 3마리 키움\n\n또는 JSON 형식:\n[{"name": "홍길동", "fact": "주말마다 등산을 감"}]`}
          className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink outline-none placeholder:text-ink-soft/60 focus:border-brand"
        />

        <ErrorText>{saveError}</ErrorText>
        {saveSuccessMsg && (
          <p className="text-xs font-semibold text-accent">{saveSuccessMsg}</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {confirmingSave ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-warn">
                ⚠️ 기존 TMI가 모두 대체됩니다. 저장할까요?
              </span>
              <Button
                type="button"
                variant="danger"
                loading={saveLoading}
                onClick={handleSaveTmi}
                className="min-h-9 px-3 text-xs"
              >
                확인 및 교체
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={saveLoading}
                onClick={() => setConfirmingSave(false)}
                className="min-h-9 px-3 text-xs"
              >
                취소
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={saveLoading || !text.trim()}
              onClick={() => {
                if (!text.trim()) {
                  setSaveError("TMI 데이터를 입력해주세요.");
                  return;
                }
                setConfirmingSave(true);
              }}
              className="min-h-9 px-3 text-xs"
            >
              전체 교체 저장
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
