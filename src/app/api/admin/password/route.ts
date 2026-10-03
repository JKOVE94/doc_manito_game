import { adminChangePassword } from "@/lib/server/auth";
import { handle, readJson, str } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  await adminChangePassword(str(body, "currentPassword", { max: 200 }), str(body, "newPassword", { min: 4, max: 100 }));
});
