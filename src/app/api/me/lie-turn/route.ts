import { requireParticipantId } from "@/lib/server/auth";
import { handle, int, readJson } from "@/lib/server/http";
import { setLieTurn } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  await setLieTurn(id, int(await readJson(req), "lieTurn", 1, 4));
});
