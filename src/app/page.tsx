"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiRequestError } from "@/lib/client/api";
import { Button, Card, ErrorText, Input } from "@/components/ui";
import type { ParticipantState } from "@/lib/types";

export default function EntryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    api<ParticipantState>("/api/me/state")
      .then(() => {
        if (active) {
          router.replace("/play");
        }
      })
      .catch(() => {
        if (active) {
          setCheckingAuth(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg("PIN 번호는 4자리 숫자여야 합니다.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await api<{ ok: boolean; participantId: string }>("/api/auth/join", {
        name: trimmedName,
        pin,
      });
      router.push("/play");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("입장에 실패했습니다. 네트워크 상태를 확인해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-ink-soft">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm font-medium">로그인 확인 중…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center justify-center rounded-2xl bg-brand/10 p-3 text-3xl">
            🎁
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            대현목장 시크릿 마니또 🎁
          </h1>
          <p className="mt-1.5 text-sm font-medium text-brand">
            10월 3일 마니또 파티
          </p>
        </header>

        <Card className="shadow-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="participant-name" className="mb-1.5 block text-sm font-semibold text-ink">
                이름
              </label>
              <Input
                id="participant-name"
                name="name"
                type="text"
                placeholder="이름 입력 (1~20자)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                required
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="participant-pin" className="mb-1.5 block text-sm font-semibold text-ink">
                PIN 4자리
              </label>
              <Input
                id="participant-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="숫자 4자리 (예: 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <p className="rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-soft">
              처음이면 새로 등록, 이미 등록했다면 같은 이름+PIN으로 다시 입장해요. PIN은 잊지 마세요!
            </p>

            <ErrorText>{errorMsg}</ErrorText>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full"
              disabled={loading || !name.trim() || pin.length !== 4}
            >
              입장하기
            </Button>
          </form>
        </Card>

        <footer className="mt-8 text-center">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center px-4 text-xs font-medium text-ink-soft/80 transition hover:text-ink hover:underline"
          >
            호스트 콘솔
          </Link>
        </footer>
      </div>
    </main>
  );
}

