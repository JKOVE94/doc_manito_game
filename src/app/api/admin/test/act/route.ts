import { requireAdmin } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { botsAct } from "@/lib/server/testmode";

export const POST = handle(async () => {
  await requireAdmin();
  return botsAct();
});
