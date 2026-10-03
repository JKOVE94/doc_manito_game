import { requireParticipantId } from "@/lib/server/auth";
import { conflict, handle, readJson, str } from "@/lib/server/http";
import { getSession } from "@/lib/server/repo";
import { createPhotoUpload } from "@/lib/server/storage";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const contentType = str(await readJson(req), "contentType", { max: 50 });
  const session = await getSession();
  if (session.status !== "ACTIVE") throw conflict("게임 진행 중에만 사진을 올릴 수 있어요.");
  return createPhotoUpload(session.id, id, contentType);
});
