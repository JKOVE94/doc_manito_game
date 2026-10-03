import { adminSetup } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await adminSetup(str(await readJson(req), "password", { min: 4, max: 100 }));
});
