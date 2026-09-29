import { controlBet } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, oneOf, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body, "action", ["open", "lock", "result"]);
  await controlBet(action, action === "result" ? oneOf(body, "winningFaction", ["LIBERAL", "FASCIST"]) : undefined);
});
