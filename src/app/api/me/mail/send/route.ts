import { requireParticipantId } from "@/lib/server/auth";
import { handle, oneOf, readJson, str } from "@/lib/server/http";
import { sendMail } from "@/lib/server/mail";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  await sendMail(id, oneOf(body, "to", ["TARGET", "MANITO"]), str(body, "question", { min: 2, max: 200 }));
});
