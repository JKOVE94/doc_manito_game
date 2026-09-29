import { openMission } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, int, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  await openMission(int(body, "slot", 1, 8), int(body, "durationMin", 1, 12 * 60));
});
