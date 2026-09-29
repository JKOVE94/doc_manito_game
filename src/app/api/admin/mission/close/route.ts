import { closeMission } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, int, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  await closeMission(int(await readJson(req), "slot", 1, 8));
});
