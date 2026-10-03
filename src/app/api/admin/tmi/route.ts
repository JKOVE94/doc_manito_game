import { requireAdmin } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";
import { NOTION_PRESET_JSON, replaceFacts } from "@/lib/server/tmi";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  // preset: "notion" → 저장소에 포함된 Notion TMI 로 교체
  if (body.preset === "notion") return replaceFacts(NOTION_PRESET_JSON);
  return replaceFacts(str(body, "text", { max: 100_000 }));
});
