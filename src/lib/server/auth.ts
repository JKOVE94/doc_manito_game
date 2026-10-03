import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { badRequest, conflict, unauthorized } from "./http";
import { getSessionSecret, getSetting, setSetting } from "./settings";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const PARTICIPANT_COOKIE = "mp_session";
const ADMIN_COOKIE = "mp_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;
const ADMIN_MAX_AGE_SEC = 60 * 60 * 24;
const ADMIN_HASH_KEY = "admin_password_hash";

// ---------------------------------------------------------------- 해시 (참가자 PIN · 관리자 비밀번호 공용)
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
async function sign(payload: string): Promise<string> {
  return createHmac("sha256", await getSessionSecret()).update(payload).digest("base64url");
}

async function verifySigned(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = value.slice(0, idx);
  const sig = Buffer.from(value.slice(idx + 1));
  const expected = Buffer.from(await sign(payload));
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
  (await cookies()).set(PARTICIPANT_COOKIE, `${payload}.${await sign(payload)}`, cookieOptions(MAX_AGE_SEC));
}

export async function clearParticipantCookie() {
  (await cookies()).delete(PARTICIPANT_COOKIE);
}

/** 로그인한 참가자 ID (없으면 401) */
export async function requireParticipantId(): Promise<string> {
  const payload = await verifySigned((await cookies()).get(PARTICIPANT_COOKIE)?.value);
  if (!payload?.startsWith("p:")) throw unauthorized();
  return payload.slice(2);
}

// ---------------------------------------------------------------- 관리자 (DB 비밀번호, ADMIN_PASSWORD 환경변수 fallback)
type AdminCredential = { kind: "db"; hash: string } | { kind: "env"; password: string } | { kind: "none" };

async function adminCredential(): Promise<AdminCredential> {
  const hash = await getSetting(ADMIN_HASH_KEY);
  if (hash) return { kind: "db", hash };
  const env = process.env.ADMIN_PASSWORD?.trim();
  return env ? { kind: "env", password: env } : { kind: "none" };
}

/** 비밀번호가 바뀌면 값이 바뀌는 버전 → 쿠키에 포함해 변경 시 기존 관리자 세션 무효화 */
function credentialVersion(c: AdminCredential): string {
  const basis = c.kind === "db" ? c.hash : c.kind === "env" ? `env:${c.password}` : "none";
  return createHash("sha256").update(basis).digest("base64url").slice(0, 12);
}

async function checkAgainst(c: AdminCredential, input: string): Promise<boolean> {
  if (c.kind === "db") return verifyPin(input, c.hash);
  if (c.kind === "env") {
    const a = createHmac("sha256", "cmp").update(input).digest();
    const b = createHmac("sha256", "cmp").update(c.password).digest();
    return timingSafeEqual(a, b);
  }
  return false;
}

export async function adminNeedsSetup(): Promise<boolean> {
  return (await adminCredential()).kind === "none";
}

async function issueAdminCookie(c: AdminCredential) {
  const payload = `admin:${Date.now() + ADMIN_MAX_AGE_SEC * 1000}:${credentialVersion(c)}`;
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${await sign(payload)}`, cookieOptions(ADMIN_MAX_AGE_SEC));
}

function validateNewPassword(pw: string) {
  if (pw.length < 4 || pw.length > 100) throw badRequest("비밀번호는 4~100자로 정해 주세요.");
}

export async function adminLogin(input: string): Promise<void> {
  const c = await adminCredential();
  if (c.kind === "none") throw conflict("관리자 비밀번호가 아직 없어요. 먼저 비밀번호를 만들어 주세요.");
  if (!(await checkAgainst(c, input))) throw unauthorized("비밀번호가 올바르지 않아요.");
  await issueAdminCookie(c);
}

/** 최초 1회: 비밀번호가 어디에도 없을 때만 설정 가능 */
export async function adminSetup(password: string): Promise<void> {
  validateNewPassword(password);
  if (!(await adminNeedsSetup())) throw conflict("이미 관리자 비밀번호가 설정되어 있어요. 로그인해 주세요.");
  await setSetting(ADMIN_HASH_KEY, await hashPin(password));
  await issueAdminCookie(await adminCredential());
}

/** 로그인한 관리자가 비밀번호 변경 → 다른 기기 세션은 버전 불일치로 만료, 현재 기기는 새 쿠키 */
export async function adminChangePassword(current: string, next: string): Promise<void> {
  await requireAdmin();
  validateNewPassword(next);
  if (!(await checkAgainst(await adminCredential(), current))) throw unauthorized("현재 비밀번호가 올바르지 않아요.");
  await setSetting(ADMIN_HASH_KEY, await hashPin(next));
  await issueAdminCookie(await adminCredential());
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function requireAdmin(): Promise<void> {
  const payload = await verifySigned((await cookies()).get(ADMIN_COOKIE)?.value);
  const [tag, exp, ver] = payload?.split(":") ?? [];
  if (tag !== "admin" || !(Number(exp) > Date.now())) throw unauthorized("관리자 로그인이 필요합니다.");
  if (ver !== credentialVersion(await adminCredential())) {
    throw unauthorized("관리자 비밀번호가 변경되어 다시 로그인해야 해요.");
  }
}
