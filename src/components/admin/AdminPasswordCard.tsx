"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/client/api";
import { Button, Card, ErrorText, Input, SectionTitle } from "@/components/ui";

export function AdminPasswordCard({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 4) return setError("새 비밀번호는 4자 이상이어야 해요.");
    if (next !== confirm) return setError("새 비밀번호 확인이 일치하지 않아요.");
    setLoading(true);
    try {
      await api("/api/admin/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "변경에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle>🔑 관리자 비밀번호 변경</SectionTitle>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Input type="password" placeholder="현재 비밀번호" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" disabled={loading} />
        <Input type="password" placeholder="새 비밀번호 (4자 이상)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" disabled={loading} />
        <Input type="password" placeholder="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading} />
        <div className="flex flex-col gap-2 sm:col-span-3">
          <ErrorText>{error}</ErrorText>
          {done && (
            <p className="text-sm font-medium text-accent">변경됐어요. 다른 기기의 관리자 로그인은 자동으로 로그아웃돼요.</p>
          )}
          <Button type="submit" variant="secondary" loading={loading} disabled={!current || !next || !confirm}>
            비밀번호 변경
          </Button>
        </div>
      </form>
    </Card>
  );
}
