import { removeParticipant } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  await removeParticipant(str(await readJson(req), "participantId", { max: 64 }));
});
