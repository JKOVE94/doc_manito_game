import { requireParticipantId } from "@/lib/server/auth";
import { handle, int, readJson, str } from "@/lib/server/http";
import { submitMission } from "@/lib/server/player";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  const note = typeof body.note === "string" ? str(body, "note", { min: 0, max: 300 }) : "";
  await submitMission(id, int(body, "slot", 1, 8), note);
});
