"use client";

import { api } from "./api";
import { getBrowserSupabase } from "./supabase-browser";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** 긴 변 1600px JPEG 로 축소 (현장 와이파이 대비). 디코딩 불가(HEIC 등) 시 원본 반환 */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * 미션 인증 사진 업로드 → 저장 경로(photoPath) 반환.
 * 서버가 발급한 1회용 서명 업로드 URL 로 Supabase Storage(비공개 버킷)에 직접 업로드.
 * 반환값을 POST /api/me/mission 의 photoPath 로 전달할 것.
 */
export async function uploadMissionPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요.");
  const blob = await compressImage(file);
  const contentType = blob.type || file.type || "image/jpeg";
  const { bucket, path, token } = await api<{ bucket: string; path: string; token: string }>(
    "/api/me/mission/upload-url",
    { contentType },
  );
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("업로드 설정이 없어요. 호스트에게 문의하세요.");
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, blob, { contentType });
  if (error) throw new Error(`사진 업로드에 실패했어요: ${error.message}`);
  return path;
}
