import { requireParticipantId } from "@/lib/server/auth";
import { badRequest, handle, readJson } from "@/lib/server/http";
import { saveKeywords } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const { keywords } = await readJson(req);
  if (!Array.isArray(keywords) || keywords.length !== 3 || !keywords.every((k) => typeof k === "string")) {
    throw badRequest("키워드 3개를 입력해 주세요.");
  }
  await saveKeywords(id, keywords);
});
