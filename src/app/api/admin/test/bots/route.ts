import { requireAdmin } from "@/lib/server/auth";
import { handle, int, oneOf, readJson } from "@/lib/server/http";
import { addBots, removeBots } from "@/lib/server/testmode";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body, "action", ["add", "remove"]);
  if (action === "add") return addBots(int(body, "count", 1, 10));
  return removeBots();
});
