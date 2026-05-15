import { getDb } from "@/db/index";
import { agents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { ConductorChatWidgetClient } from "./conductor-chat-widget-client";

export async function ConductorChatWidget({
  businessId,
}: {
  businessId: string;
}) {
  const db = getDb();
  const conductor = await db.query.agents.findFirst({
    where: and(
      eq(agents.businessId, businessId),
      eq(agents.isPlatformDefault, true),
    ),
    columns: { id: true },
  });

  if (!conductor) {
    return null;
  }

  return (
    <ConductorChatWidgetClient
      businessId={businessId}
      conductorAgentId={conductor.id}
    />
  );
}
