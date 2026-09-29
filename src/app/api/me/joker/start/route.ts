import { requireParticipantId } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { jokerStart } from "@/lib/server/player";

export const POST = handle(async () => jokerStart(await requireParticipantId()));
