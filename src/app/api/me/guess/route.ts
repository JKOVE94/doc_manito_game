import { requireParticipantId } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { makeGuess } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  await makeGuess(id, str(await readJson(req), "participantId", { max: 64 }));
});
