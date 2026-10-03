import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { impersonateBot } from "@/lib/server/testmode";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  await impersonateBot(str(await readJson(req), "participantId", { max: 64 }));
});
