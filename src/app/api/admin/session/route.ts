import { resetGame, setPhase, startGame } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { badRequest, handle, oneOf, readJson } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body, "action", ["start", "guessing", "finish", "back-to-active", "reset"]);
  if (action === "start") return startGame(body.force === true);
  if (action === "reset") {
    if (body.confirm !== "RESET") throw badRequest("확인 문구 RESET 을 입력해 주세요.");
    return resetGame(body.keepParticipants === true);
  }
  return setPhase(action);
});
