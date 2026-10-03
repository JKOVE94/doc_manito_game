import { requireAdmin } from "@/lib/server/auth";
import { handle, oneOf, readJson } from "@/lib/server/http";
import { sendQuizNow } from "@/lib/server/quiz";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  oneOf(await readJson(req), "action", ["send-now"]);
  await sendQuizNow();
});
