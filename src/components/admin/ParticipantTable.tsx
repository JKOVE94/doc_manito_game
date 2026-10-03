"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { AdminParticipantRow, SessionStatus } from "@/lib/types";

interface ParticipantTableProps {
  participants: AdminParticipantRow[];
  sessionStatus: SessionStatus;
  onRefresh: () => Promise<void>;
}

export function ParticipantTable({
  participants,
  sessionStatus,
  onRefresh,
}: ParticipantTableProps) {
  const [showLieNumbers, setShowLieNumbers] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [impersonateLoadingId, setImpersonateLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImpersonate = async (participantId: string) => {
    setImpersonateLoadingId(participantId);
    setErrorMsg(null);
    try {
      await api("/api/admin/test/impersonate", { participantId });
      window.open("/play", "_blank");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("봇 로그인 전환에 실패했습니다.");
      }
    } finally {
      setImpersonateLoadingId(null);
    }
  };

  const handleDelete = async (participantId: string) => {
    setLoadingId(participantId);
    setErrorMsg(null);
    try {
      await api("/api/admin/participant/remove", { participantId });
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("참가자 삭제 요청에 실패했습니다.");
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-soft">총 {participants.length}명</span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowLieNumbers((prev) => !prev)}
              className="min-h-9 px-2.5 py-1 text-xs"
            >
              {showLieNumbers ? "순번 숨기기" : "순번 보기"}
            </Button>
          </div>
        }
      >
        참가자 목록
      </SectionTitle>

      <ErrorText>{errorMsg}</ErrorText>

      {participants.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          아직 입장한 참가자가 없습니다.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-xs font-semibold text-ink-soft">
                <th className="px-3 py-2.5">이름</th>
                <th className="px-3 py-2.5">익명 닉네임</th>
                <th className="px-3 py-2.5 text-center">키워드</th>
                <th className="px-3 py-2.5 text-center">
                  거짓말 순번 {showLieNumbers ? "(숫자)" : "(입력여부)"}
                </th>
                <th className="px-3 py-2.5 text-center">퀴즈</th>
                <th className="px-3 py-2.5 text-center">배팅</th>
                <th className="px-3 py-2.5 text-center">추리</th>
                {sessionStatus === "READY" && (
                  <th className="px-3 py-2.5 text-right">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {participants.map((p) => {
                const isDeleting = confirmDeleteId === p.id;
                const isLoading = loadingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-3 py-3 font-semibold text-ink">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{p.name}</span>
                        {p.isBot && <Badge tone="warn">봇</Badge>}
                        {p.isBot && (
                          <Button
                            type="button"
                            variant="ghost"
                            loading={impersonateLoadingId === p.id}
                            disabled={impersonateLoadingId !== null}
                            onClick={() => handleImpersonate(p.id)}
                            className="min-h-7 px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand/10"
                            title="이 봇으로 새 탭에서 열기"
                          >
                            봇으로 보기
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-soft">
                      {p.alias ? (
                        <span className="font-medium text-ink">{p.alias}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge tone={p.keywordCount === 3 ? "accent" : p.keywordCount > 0 ? "warn" : "neutral"}>
                        {p.keywordCount}/3
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {p.lieTurn !== null ? (
                        showLieNumbers ? (
                          <span className="font-bold text-brand">#{p.lieTurn}</span>
                        ) : (
                          <span className="font-bold text-accent">✔</span>
                        )
                      ) : (
                        <span className="text-ink-soft">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-semibold text-ink">
                      {p.quizScore}점
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {p.hasBet ? (
                        <span className="font-bold text-accent">✔</span>
                      ) : (
                        <span className="text-ink-soft">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {p.hasGuess ? (
                        <span className="font-bold text-accent">✔</span>
                      ) : (
                        <span className="text-ink-soft">-</span>
                      )}
                    </td>

                    {sessionStatus === "READY" && (
                      <td className="px-3 py-3 text-right">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs font-semibold text-danger">삭제?</span>
                            <Button
                              type="button"
                              variant="danger"
                              loading={isLoading}
                              onClick={() => handleDelete(p.id)}
                              className="min-h-8 px-2 py-1 text-xs"
                            >
                              확인
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={isLoading}
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-8 px-2 py-1 text-xs"
                            >
                              취소
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="min-h-8 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                          >
                            삭제
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
