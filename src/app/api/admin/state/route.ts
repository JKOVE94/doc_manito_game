import { requireAdmin } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { buildAdminState } from "@/lib/server/views";

export const GET = handle(async () => {
  await requireAdmin();
  return buildAdminState();
});
