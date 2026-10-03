import "server-only";
import { randomUUID } from "node:crypto";
import { PHOTO_BUCKET } from "@/lib/config";
import { badRequest } from "./http";
import { db } from "./supabase";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export const photoPrefix = (sessionId: string, participantId: string) => `${sessionId}/${participantId}/`;

/** 1회용 서명 업로드 URL 발급 (클라이언트가 Storage 로 직접 업로드 → 함수 본문 크기 제한 회피) */
export async function createPhotoUpload(sessionId: string, participantId: string, contentType: string) {
  const ext = EXT[contentType];
  if (!ext) throw badRequest("JPG·PNG·WEBP·HEIC 이미지만 올릴 수 있어요.");
  const path = `${photoPrefix(sessionId, participantId)}${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`[storage] signed upload: ${error?.message}`);
  return { bucket: PHOTO_BUCKET, path: data.path, token: data.token };
}

/** 비공개 사진 → 1시간짜리 서명 조회 URL (경로 → URL) */
export async function signPhotoUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrls(unique, 3600);
  if (error) {
    console.error("[storage] sign urls", error.message);
    return out;
  }
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}
