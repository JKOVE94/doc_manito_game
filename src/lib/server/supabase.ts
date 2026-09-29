import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/** service_role 클라이언트 — 서버 전용. 절대 클라이언트 번들로 가져가지 말 것 */
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Supabase 응답에서 error 가 있으면 throw, 아니면 data 반환 */
export function must<T>(res: { data: T; error: { message: string } | null }, context: string): T {
  if (res.error) throw new Error(`[db] ${context}: ${res.error.message}`);
  return res.data;
}

/** .single() 결과용: error 또는 null 이면 throw, 아니면 non-null data 반환 */
export function mustOne<T>(res: { data: T | null; error: { message: string } | null }, context: string): T {
  const data = must(res, context);
  if (data === null) throw new Error(`[db] ${context}: no row`);
  return data;
}
