import { checkAdminPassword, setAdminCookie } from "@/lib/server/auth";
import { handle, readJson, str, unauthorized } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  if (!checkAdminPassword(str(await readJson(req), "password", { max: 200 }))) {
    throw unauthorized("비밀번호가 올바르지 않아요.");
  }
  await setAdminCookie();
});
