import { requireParticipantId } from "@/lib/server/auth";
import { handle, int, readJson, str } from "@/lib/server/http";
import { answerQuiz } from "@/lib/server/quiz";

export const POST = handle(async (req: Request) => {
  const id = await requireParticipantId();
  const body = await readJson(req);
  return answerQuiz(id, str(body, "quizId", { max: 64 }), int(body, "optionIndex", 0, 3));
});
