import { adminLogin } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  await adminLogin(str(await readJson(req), "password", { max: 200 }));
});
