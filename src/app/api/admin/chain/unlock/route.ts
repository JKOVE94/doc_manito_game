import { MAX_HINT_LEVEL } from "@/lib/config";
import { setUnlockLevel } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, int, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  await setUnlockLevel(str(body, "chainId", { max: 64 }), int(body, "level", 0, MAX_HINT_LEVEL));
});
