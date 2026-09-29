import "server-only";
import { ConfigError } from "./env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = "로그인이 필요합니다.") => new HttpError(401, msg);
export const conflict = (msg: string, extra?: Record<string, unknown>) => new HttpError(409, msg, extra);

/** Route Handler 공통 래퍼: HttpError → JSON 에러, 그 외 → 500 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<Response> => {
    try {
      const result = await fn(...args);
      return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      }
      console.error(e);
      if (e instanceof ConfigError) return Response.json({ error: e.message }, { status: 500 });
      return Response.json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fallthrough
  }
  throw badRequest("요청 형식이 올바르지 않습니다.");
}

export function str(body: Record<string, unknown>, key: string, { min = 1, max = 200 } = {}): string {
  const v = body[key];
  if (typeof v !== "string") throw badRequest(`${key} 값이 필요합니다.`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw badRequest(`${key} 길이는 ${min}~${max}자여야 합니다.`);
  return t;
}

export function int(body: Record<string, unknown>, key: string, min: number, max: number): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw badRequest(`${key} 값은 ${min}~${max} 사이 정수여야 합니다.`);
  }
  return v;
}

export function oneOf<const T extends string>(body: Record<string, unknown>, key: string, values: readonly T[]): T {
  const v = body[key];
  if (typeof v !== "string" || !values.includes(v as T)) throw badRequest(`${key} 값이 올바르지 않습니다.`);
  return v as T;
}
