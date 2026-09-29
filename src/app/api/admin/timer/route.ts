import { controlTimer } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, int, oneOf, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body, "action", ["start", "pause", "resume", "end", "reset", "reveal", "hide"]);
  await controlTimer(action, action === "start" ? int(body, "durationSec", 10, 3 * 60 * 60) : undefined);
});
