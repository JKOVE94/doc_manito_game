import { requireParticipantId } from "@/lib/server/auth";
import { setAway } from "@/lib/server/away";
import { badRequest, handle, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const { away } = await readJson(req);
  if (typeof away !== "boolean") throw badRequest("away 값이 필요합니다.");
  await setAway(id, away, "SELF");
});
