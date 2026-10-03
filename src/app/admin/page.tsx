"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { useLiveState } from "@/lib/client/useLiveState";
import { Button, Card, ErrorText } from "@/components/ui";
import type { AdminState } from "@/lib/types";

import { SessionControl } from "@/components/admin/SessionControl";
import { ParticipantTable } from "@/components/admin/ParticipantTable";
import { TruthLieController } from "@/components/admin/TruthLieController";
import { MissionManager } from "@/components/admin/MissionManager";
import { TmiManager } from "@/components/admin/TmiManager";
import { SubmissionReview } from "@/components/admin/SubmissionReview";
import { ChainBoard } from "@/components/admin/ChainBoard";
import { BetController } from "@/components/admin/BetController";
import { DangerZone } from "@/components/admin/DangerZone";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminPasswordCard } from "@/components/admin/AdminPasswordCard";
import { TestTools } from "@/components/admin/TestTools";

export default function AdminPage() {
  const { data, error, refresh, clockOffsetMs } = useLiveState<AdminState>(
    "/api/admin/state",
  );

  const [logoutLoading, setLogoutLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await api("/api/admin/logout", {});
      await refresh();
    } catch {
      // Refresh anyway to re-check status
      await refresh();
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshLoading(true);
    try {
      await refresh();
    } finally {
      setRefreshLoading(false);
    }
  };

  // 1. 401 → 최초 비밀번호 설정 또는 로그인
  if (error && error.status === 401) {
    return <AdminGate onDone={refresh} />;
  }

  // 2. Loading state when no data yet
  if (!data && !error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-ink-soft">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm font-medium">관리자 콘솔 로딩 중…</p>
        </div>
      </main>
    );
  }

  // 3. Connection / other error state without data
  if (error && !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4 text-center">
        <Card className="max-w-sm w-full flex flex-col items-center gap-3 py-6">
          <span className="text-3xl">⚠️</span>
          <p className="text-base font-bold text-ink">상태를 불러올 수 없습니다</p>
          <ErrorText>{error.message}</ErrorText>
          <Button
            type="button"
            variant="primary"
            onClick={handleManualRefresh}
            loading={refreshLoading}
            className="mt-2"
          >
            다시 시도
          </Button>
        </Card>
      </main>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-ink-soft hover:text-ink transition"
              title="참가자 화면으로 이동"
            >
              ←
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <h1 className="text-lg font-bold tracking-tight text-ink sm:text-xl">
                호스트 콘솔
              </h1>
            </div>
            <span className="hidden font-mono text-[11px] text-ink-soft/70 sm:inline">
              rev.{data.revision}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleManualRefresh}
              loading={refreshLoading}
              className="min-h-10 px-3 text-xs"
              title="새로고침"
            >
              ↻ 새로고침
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleLogout}
              loading={logoutLoading}
              className="min-h-10 px-3 text-xs"
            >
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          {/* 1. SessionControl */}
          <SessionControl
            session={data.session}
            participantsCount={data.participants.length}
            botCount={data.botCount}
            onRefresh={refresh}
          />

          {/* 2. ParticipantTable */}
          <ParticipantTable
            participants={data.participants}
            sessionStatus={data.session.status}
            onRefresh={refresh}
          />

          {/* 3. TruthLieController */}
          <TruthLieController
            truthLie={data.truthLie}
            clockOffsetMs={clockOffsetMs}
            onRefresh={refresh}
          />

          {/* 4. MissionManager */}
          <MissionManager
            missions={data.missions}
            clockOffsetMs={clockOffsetMs}
            onRefresh={refresh}
          />

          {/* 5. TmiManager (신규, MissionManager 다음) */}
          <TmiManager
            tmi={data.tmi}
            quiz={data.quiz}
            sessionStatus={data.session.status}
            onRefresh={refresh}
          />

          {/* 6. SubmissionReview */}
          <SubmissionReview
            submissions={data.submissions}
            onRefresh={refresh}
          />

          {/* 7. ChainBoard (ACTIVE 이후) */}
          <ChainBoard
            chains={data.chains}
            sessionStatus={data.session.status}
            maxHintLevel={data.maxHintLevel}
            onRefresh={refresh}
          />

          {/* 8. BetController */}
          <BetController
            bets={data.bets}
            onRefresh={refresh}
          />

          {/* TestTools */}
          <div className="lg:col-span-2">
            <TestTools
              session={data.session}
              participants={data.participants}
              botCount={data.botCount}
              onRefresh={refresh}
            />
          </div>

          {/* 8. DangerZone */}
          <div className="lg:col-span-2">
            <AdminPasswordCard onRefresh={refresh} />
          </div>
          <div className="lg:col-span-2">
            <DangerZone onRefresh={refresh} />
          </div>
        </div>
      </main>
    </div>
  );
}
