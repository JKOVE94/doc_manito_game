"use client";

import { useMemo, useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, SectionTitle } from "@/components/ui";
import type { AdminSubmissionRow, SubmissionStatus } from "@/lib/types";

interface SubmissionReviewProps {
  submissions: AdminSubmissionRow[];
  onRefresh: () => Promise<void>;
}

type FilterType = "ALL" | SubmissionStatus;

export function SubmissionReview({
  submissions,
  onRefresh,
}: SubmissionReviewProps) {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sorting: PENDING first, then by createdAt desc
  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    if (filter === "ALL") return sortedSubmissions;
    return sortedSubmissions.filter((s) => s.status === filter);
  }, [sortedSubmissions, filter]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const s of submissions) {
      if (s.status === "PENDING") pending++;
      else if (s.status === "APPROVED") approved++;
      else if (s.status === "REJECTED") rejected++;
    }
    return { all: submissions.length, pending, approved, rejected };
  }, [submissions]);

  const handleReview = async (
    submissionId: string,
    decision: SubmissionStatus,
  ) => {
    setLoadingId(submissionId);
    setErrorMsg(null);
    try {
      await api("/api/admin/submission/review", {
        submissionId,
        decision,
      });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("제출 검토 처리에 실패했습니다.");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case "PENDING":
        return <Badge tone="warn">검토 대기</Badge>;
      case "APPROVED":
        return <Badge tone="accent">승인 완료</Badge>;
      case "REJECTED":
        return <Badge tone="danger">반려됨</Badge>;
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle
        right={
          counts.pending > 0 ? (
            <Badge tone="warn">대기 {counts.pending}건</Badge>
          ) : undefined
        }
      >
        미션 제출 검토
      </SectionTitle>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
            filter === "ALL"
              ? "bg-ink text-surface"
              : "bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          전체 ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setFilter("PENDING")}
          className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
            filter === "PENDING"
              ? "bg-warn text-white"
              : "bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          대기 ({counts.pending})
        </button>
        <button
          type="button"
          onClick={() => setFilter("APPROVED")}
          className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
            filter === "APPROVED"
              ? "bg-accent text-white"
              : "bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          승인 ({counts.approved})
        </button>
        <button
          type="button"
          onClick={() => setFilter("REJECTED")}
          className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
            filter === "REJECTED"
              ? "bg-danger text-white"
              : "bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          반려 ({counts.rejected})
        </button>
      </div>

      <ErrorText>{errorMsg}</ErrorText>

      {filteredSubmissions.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          해당 상태의 미션 제출 내역이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSubmissions.map((s) => {
            const isLoading = loadingId === s.id;

            return (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-sm transition hover:border-ink-soft/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-ink">
                    <span className="text-brand">#{s.missionSlot}</span>
                    <span>{s.missionTitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-soft">
                      {new Date(s.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {getStatusBadge(s.status)}
                  </div>
                </div>

                <div className="text-xs font-medium text-ink-soft">
                  제출자: <strong className="text-ink">{s.participant.name}</strong>
                </div>

                {s.note ? (
                  <div className="rounded-lg bg-surface-2 p-2.5 text-xs text-ink whitespace-pre-wrap">
                    {s.note}
                  </div>
                ) : (
                  <div className="text-xs italic text-ink-soft">메모 없음</div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-line/50">
                  {s.status === "PENDING" && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "REJECTED")}
                        className="min-h-9 px-3 py-1 text-xs text-danger border-danger/20 hover:bg-danger/10"
                      >
                        반려 ❌
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "APPROVED")}
                        className="min-h-9 px-3 py-1 text-xs bg-accent text-white hover:brightness-105"
                      >
                        승인 ✔
                      </Button>
                    </>
                  )}

                  {s.status === "APPROVED" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "PENDING")}
                        className="min-h-9 px-2.5 py-1 text-xs text-ink-soft"
                      >
                        대기로 되돌리기
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "REJECTED")}
                        className="min-h-9 px-2.5 py-1 text-xs text-danger"
                      >
                        반려로 변경
                      </Button>
                    </>
                  )}

                  {s.status === "REJECTED" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "PENDING")}
                        className="min-h-9 px-2.5 py-1 text-xs text-ink-soft"
                      >
                        대기로 되돌리기
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        loading={isLoading}
                        onClick={() => handleReview(s.id, "APPROVED")}
                        className="min-h-9 px-2.5 py-1 text-xs text-accent"
                      >
                        승인으로 변경
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
