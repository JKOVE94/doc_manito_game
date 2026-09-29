import { reviewSubmission } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/auth";
import { handle, oneOf, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const body = await readJson(req);
  await reviewSubmission(
    str(body, "submissionId", { max: 64 }),
    oneOf(body, "decision", ["APPROVED", "REJECTED", "PENDING"]),
  );
});
