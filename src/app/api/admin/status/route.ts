import { adminNeedsSetup } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const GET = handle(async () => ({ needsSetup: await adminNeedsSetup() }));
