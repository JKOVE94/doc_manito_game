import "server-only";
import { GEMINI_DEFAULT_MODEL } from "@/lib/config";

/** 배포 설정 누락/오류. 메시지에 값은 절대 포함하지 않고 변수 이름만 담는다 → 화면에 그대로 노출해도 안전 */
export class ConfigError extends Error {}

/** 앞뒤 공백·따옴표 제거 (대시보드 붙여넣기 실수 방지) */
function read(name: string): string | undefined {
  const v = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}

function required(...names: string[]): string {
  for (const name of names) {
    const v = read(name);
    if (v) return v;
  }
  throw new ConfigError(`서버 설정 오류: 환경변수 ${names.join(" 또는 ")} 가 설정되지 않았습니다. 설정 후 재배포하세요.`);
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  },
  /** 신규 secret key(sb_secret_…) 우선, 레거시 service_role 키 fallback */
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  },
  /** 없으면 AI 힌트 기능 비활성화 */
  get geminiApiKey(): string | null {
    return read("GEMINI_API_KEY") ?? null;
  },
  get geminiModel(): string {
    return read("GEMINI_MODEL") ?? GEMINI_DEFAULT_MODEL;
  },
  /** 테스트용 목 서버 지정 시에만 사용 */
  get geminiBaseUrl(): string {
    return read("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com";
  },
};
