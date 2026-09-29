import { askAboutTarget } from "@/lib/server/ask";
import { requireParticipantId } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  return askAboutTarget(id, str(await readJson(req), "question", { max: 200 }));
});
