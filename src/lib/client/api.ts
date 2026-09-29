import type { ApiError } from "@/lib/types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** JSON API 호출. 실패 시 서버의 한국어 메시지를 담은 ApiRequestError 를 throw */
export async function api<T = { ok: true }>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) {
    const message = (data as ApiError).error ?? `요청 실패 (${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}
