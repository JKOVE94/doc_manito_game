import "server-only";
import { randomBytes } from "node:crypto";
import { db, must } from "./supabase";

export async function getSetting(key: string): Promise<string | null> {
  const row = must(
    await db().from("app_settings").select("value").eq("key", key).maybeSingle<{ value: string }>(),
    `get setting ${key}`,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  must(
    await db().from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }),
    `set setting ${key}`,
  );
}

/** 값이 없을 때만 저장 (동시 최초 생성 경합 시 먼저 저장된 값 사용) */
async function getOrCreate(key: string, create: () => string): Promise<string> {
  const existing = await getSetting(key);
  if (existing) return existing;
  await db().from("app_settings").upsert({ key, value: create() }, { onConflict: "key", ignoreDuplicates: true });
  const saved = await getSetting(key);
  if (!saved) throw new Error(`[settings] failed to create ${key}`);
  return saved;
}

let cachedSecret: string | null = null;

/**
 * 쿠키 서명 키: SESSION_SECRET 환경변수가 있으면 그것을, 없으면 DB 에 자동 생성된 키를 사용.
 * (서버 인스턴스별 메모리 캐시)
 */
export async function getSessionSecret(): Promise<string> {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  cachedSecret ??= await getOrCreate("session_secret", () => randomBytes(48).toString("base64url"));
  return cachedSecret;
}
