import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { replaceFacts } from "@/lib/server/tmi";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  return replaceFacts(str(await readJson(req), "text", { max: 100_000 }));
});
