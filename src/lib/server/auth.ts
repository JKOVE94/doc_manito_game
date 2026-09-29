import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { env } from "./env";
import { unauthorized } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const PARTICIPANT_COOKIE = "mp_session";
const ADMIN_COOKIE = "mp_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;
const ADMIN_MAX_AGE_SEC = 60 * 60 * 24;

// ---------------------------------------------------------------- PIN
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------- 서명 쿠키
function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

function verifySigned(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = value.slice(0, idx);
  const sig = Buffer.from(value.slice(idx + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return payload;
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function setParticipantCookie(participantId: string) {
  const payload = `p:${participantId}`;
  (await cookies()).set(PARTICIPANT_COOKIE, `${payload}.${sign(payload)}`, cookieOptions(MAX_AGE_SEC));
}

export async function clearParticipantCookie() {
  (await cookies()).delete(PARTICIPANT_COOKIE);
}

/** 로그인한 참가자 ID (없으면 401) */
export async function requireParticipantId(): Promise<string> {
  const payload = verifySigned((await cookies()).get(PARTICIPANT_COOKIE)?.value);
  if (!payload?.startsWith("p:")) throw unauthorized();
  return payload.slice(2);
}

// ---------------------------------------------------------------- 관리자
export function checkAdminPassword(input: string): boolean {
  const a = createHmac("sha256", "cmp").update(input).digest();
  const b = createHmac("sha256", "cmp").update(env.adminPassword).digest();
  return timingSafeEqual(a, b);
}

export async function setAdminCookie() {
  const payload = `admin:${Date.now() + ADMIN_MAX_AGE_SEC * 1000}`;
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, cookieOptions(ADMIN_MAX_AGE_SEC));
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const payload = verifySigned((await cookies()).get(ADMIN_COOKIE)?.value);
  const exp = Number(payload?.split(":")[1]);
  if (!payload?.startsWith("admin:") || !(exp > Date.now())) throw unauthorized("관리자 로그인이 필요합니다.");
}
