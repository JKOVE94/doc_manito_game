import { setParticipantCookie } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { join } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const { participantId } = await join(str(body, "name", { max: 20 }), str(body, "pin", { min: 4, max: 4 }));
  await setParticipantCookie(participantId);
  return { ok: true, participantId };
});
