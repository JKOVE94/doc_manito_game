"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiRequestError } from "@/lib/client/api";
import { Button, Card, ErrorText, Input } from "@/components/ui";

/** 401 일 때: 비밀번호가 없으면 최초 설정, 있으면 로그인 */
export function AdminGate({ onDone }: { onDone: () => Promise<void> }) {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/admin/status")
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (needsSetup) {
      if (password.length < 4) return setError("비밀번호는 4자 이상으로 정해 주세요.");
      if (password !== confirm) return setError("비밀번호 확인이 일치하지 않아요.");
    } else if (!password.trim()) {
      return setError("비밀번호를 입력해 주세요.");
    }
    setLoading(true);
    try {
      await api(needsSetup ? "/api/admin/setup" : "/api/admin/login", { password });
      setPassword("");
      setConfirm("");
      await onDone();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "요청에 실패했어요.";
      // 다른 기기에서 먼저 설정한 경우 → 로그인 화면으로 전환
      if (err instanceof ApiRequestError && err.status === 409) setNeedsSetup(false);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-2xl bg-brand/10 p-3 text-3xl">
            {needsSetup ? "🔐" : "🛡️"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {needsSetup ? "관리자 비밀번호 만들기" : "호스트 콘솔"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {needsSetup
              ? "처음 한 번만 설정해요. 이 비밀번호로 호스트 콘솔에 들어와요."
              : "관리자 비밀번호를 입력해 주세요."}
          </p>
        </header>

        <Card className="shadow-md">
          {needsSetup === null ? (
            <p className="py-6 text-center text-sm text-ink-soft">확인 중…</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-ink">
                  {needsSetup ? "새 비밀번호 (4자 이상)" : "비밀번호"}
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete={needsSetup ? "new-password" : "current-password"}
                  disabled={loading}
                />
              </div>
              {needsSetup && (
                <div>
                  <label htmlFor="admin-password-confirm" className="mb-1.5 block text-sm font-semibold text-ink">
                    비밀번호 확인
                  </label>
                  <Input
                    id="admin-password-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
              )}
              <ErrorText>{error}</ErrorText>
              <Button type="submit" loading={loading} disabled={!password} className="w-full">
                {needsSetup ? "비밀번호 만들고 입장" : "관리자 로그인"}
              </Button>
            </form>
          )}
        </Card>

        <footer className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center px-4 text-xs font-medium text-ink-soft/80 hover:text-ink"
          >
            ← 참가자 입장 화면으로 돌아가기
          </Link>
        </footer>
      </div>
    </main>
  );
}
