import { saveMission } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, int, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  const description = typeof body.description === "string" ? str(body, "description", { min: 0, max: 500 }) : "";
  await saveMission(int(body, "slot", 1, 8), str(body, "title", { max: 60 }), description);
});
