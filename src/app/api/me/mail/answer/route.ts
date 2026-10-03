import { requireParticipantId } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { answerMail } from "@/lib/server/mail";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  await answerMail(id, str(body, "mailId", { max: 64 }), str(body, "answer", { max: 300 }));
});
