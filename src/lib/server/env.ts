import "server-only";
import { GEMINI_DEFAULT_MODEL } from "@/lib/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return process.env.SUPABASE_URL ?? required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get sessionSecret() {
    const v = required("SESSION_SECRET");
    if (v.length < 16) throw new Error("SESSION_SECRET 은 16자 이상이어야 합니다.");
    return v;
  },
  /** 없으면 AI 힌트 기능 비활성화 */
  get geminiApiKey(): string | null {
    return process.env.GEMINI_API_KEY || null;
  },
  get geminiModel(): string {
    return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  },
  /** 테스트용 목 서버 지정 시에만 사용 */
  get geminiBaseUrl(): string {
    return process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
};
