import { requireAdmin } from "@/lib/server/auth";
import { setAway } from "@/lib/server/away";
import { badRequest, handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  if (typeof body.away !== "boolean") throw badRequest("away 값이 필요합니다.");
  await setAway(str(body, "participantId", { max: 64 }), body.away, "ADMIN");
});
