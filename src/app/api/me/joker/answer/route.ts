import { requireParticipantId } from "@/lib/server/auth";
import { handle, int, readJson } from "@/lib/server/http";
import { jokerAnswer } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  return jokerAnswer(id, int(await readJson(req), "optionIndex", 0, 3));
});
