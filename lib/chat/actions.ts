"use server";

import { getDb } from "@/db/index";
import { agents, chatMessages, chatSessions } from "@/db/schema";
import { ensureBusiness } from "@/lib/business/ensure";
import { requireSessionUserId } from "@/lib/roster/session";
import { and, desc, eq } from "drizzle-orm";

/** Create a new chat session for a given agent. */
export async function createChatSession(
  businessId: string,
  agentId: string,
): Promise<{ id: string }> {
  await requireSessionUserId();
  await ensureBusiness(businessId);
  const db = getDb();

  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, agentId), eq(agents.businessId, businessId)),
    columns: { name: true },
  });
  if (!agent) throw new Error("Agent not found");

  const [row] = await db
    .insert(chatSessions)
    .values({
      businessId,
      agentId,
      title: `Chat with ${agent.name}`,
    })
    .returning({ id: chatSessions.id });

  if (!row) throw new Error("Failed to create chat session");
  return { id: row.id };
}

/** Update the Cursor agent ID after SDK session is created. */
export async function updateSessionCursorAgentId(
  sessionId: string,
  cursorAgentId: string,
): Promise<void> {
  await requireSessionUserId();
  const db = getDb();
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
    columns: { businessId: true },
  });
  if (!session) throw new Error("Session not found");
  await ensureBusiness(session.businessId);
  await db
    .update(chatSessions)
    .set({ cursorAgentId, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

/** Save a message to the DB. Caller must own the session's business. */
export async function saveChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await requireSessionUserId();
  const db = getDb();
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
    columns: { businessId: true },
  });
  if (!session) throw new Error("Session not found");
  await ensureBusiness(session.businessId);
  await db.insert(chatMessages).values({
    sessionId,
    role,
    content,
    metadata: metadata ?? null,
  });
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

/** List chat sessions for a business, newest first. */
export async function listChatSessions(businessId: string) {
  await requireSessionUserId();
  await ensureBusiness(businessId);
  const db = getDb();
  return db.query.chatSessions.findMany({
    where: eq(chatSessions.businessId, businessId),
    orderBy: [desc(chatSessions.updatedAt)],
    with: {
      agent: {
        columns: { name: true, slug: true, isPlatformDefault: true },
      },
    },
  });
}

/** Get a single session with its messages. */
export async function getChatSession(sessionId: string) {
  await requireSessionUserId();
  const db = getDb();
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
    with: {
      messages: { orderBy: [desc(chatMessages.createdAt)] },
      agent: {
        columns: { id: true, name: true, slug: true, isPlatformDefault: true },
      },
    },
  });
  if (!session) throw new Error("Session not found");
  await ensureBusiness(session.businessId);
  return { ...session, messages: session.messages.reverse() };
}
