import { requireParticipantId } from "@/lib/server/auth";
import { badRequest, handle, readJson } from "@/lib/server/http";
import { setReady } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const { ready } = await readJson(req);
  if (typeof ready !== "boolean") throw badRequest("ready 값이 필요합니다.");
  await setReady(id, ready);
});
