// 공용 UI 프리미티브. 참가자/관리자 화면 모두 이 컴포넌트와 테마 토큰(bg, surface, ink, brand, accent …)을 사용할 것.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:brightness-105",
  secondary: "bg-surface-2 text-ink border border-line hover:brightness-95",
  ghost: "bg-transparent text-ink-soft hover:text-ink",
  danger: "bg-danger text-white hover:brightness-105",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {loading ? "처리 중…" : children}
    </button>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx("rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]", className)}
    />
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[17px] font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-ink-soft/70 focus:border-brand",
        className,
      )}
    />
  );
}

type Tone = "neutral" | "brand" | "accent" | "warn" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-soft",
  brand: "bg-brand/15 text-brand",
  accent: "bg-accent/15 text-accent",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm font-medium text-danger">{children}</p>;
}

/** 초 → "mm:ss" */
export function formatClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export { cx };
