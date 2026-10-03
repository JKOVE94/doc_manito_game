import { openNextMissionNow, setMissionAuto } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { badRequest, handle, readJson } from "@/lib/server/http";

/** { enabled: boolean } 자동 오픈 켜기/끄기 | { action: "open-next" } 다음 미션 지금 열기 */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  if (body.action === "open-next") return openNextMissionNow();
  if (typeof body.enabled !== "boolean") throw badRequest("enabled 값이 필요합니다.");
  await setMissionAuto(body.enabled);
});
