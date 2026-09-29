import { requireParticipantId } from "@/lib/server/auth";
import { handle, oneOf, readJson } from "@/lib/server/http";
import { placeBet } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  await placeBet(id, oneOf(body, "faction", ["LIBERAL", "FASCIST"]), oneOf(body, "prediction", ["WIN", "LOSE"]));
});
