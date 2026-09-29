import { requireParticipantId } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { buildParticipantState } from "@/lib/server/views";

export const GET = handle(async () => buildParticipantState(await requireParticipantId()));
