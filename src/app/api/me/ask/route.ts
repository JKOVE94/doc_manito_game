import { askAI } from "@/lib/server/ask";
import { requireParticipantId } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  return askAI(id, str(body, "question", { max: 200 }));
});
