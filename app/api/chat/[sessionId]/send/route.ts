import type { NextRequest } from "next/server";
import { Agent } from "@cursor/sdk";
import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/index";
import { agents, businesses, chatMessages, chatSessions, memory } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import {
  applyConductorInstructionPlaceholders,
  loadConductorOrchestrationSnapshot,
} from "@/lib/conductor/conductor-context";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { buildRepoContextForPrompt } from "@/lib/github/repo-context";
import { resolveCursorApiKeyForBusiness } from "@/lib/settings/cursor-api-key";

/** Strip HTML tags from Tiptap-stored memory content for plain-text injection. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Builds a business context prefix for non-Conductor agents.
 * Returns { prefix, localPath } so the route can pass localPath to local.cwd.
 */
async function buildBusinessContext(businessId: string): Promise<{
  prefix: string;
  localPath: string | null;
}> {
  const db = getDb();

  const [biz] = await db
    .select({ name: businesses.name, localPath: businesses.localPath })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const soulRow = await db
    .select({ content: memory.content })
    .from(memory)
    .where(and(eq(memory.businessId, businessId), eq(memory.scope, "business"), isNull(memory.agentId)))
    .orderBy(desc(memory.updatedAt))
    .limit(1);

  const businessName = biz?.name?.trim() || "the business";
  const localPath = biz?.localPath ?? null;
  const soulText = soulRow[0]?.content ? htmlToPlainText(soulRow[0].content) : "";

  const lines: string[] = [
    `## Business context`,
    `You are working for **${businessName}**.`,
    `IMPORTANT: Only use information provided in this prompt. Do not reference any other local codebase or workspace unless explicitly shown below.`,
  ];

  if (soulText) {
    lines.push(``, `### Business memory`, soulText);
  }

  return { prefix: lines.join("\n"), localPath };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const { data: sessionAuth } = await auth.getSession();
  const userId = sessionAuth?.user?.id;
  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { message?: string; businessId?: string };
  try {
    body = (await req.json()) as { message?: string; businessId?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";

  const MAX_MESSAGE_CHARS = 8_000;
  if (!message.trim() || !businessId) {
    return new Response(JSON.stringify({ error: "Missing message or businessId" }), {
      status: 400,
    });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return new Response(
      JSON.stringify({ error: `Message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters` }),
      { status: 400 },
    );
  }

  try {
    await assertUserBusinessAccess(userId, businessId);
  } catch {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const db = getDb();

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
    columns: { id: true, agentId: true, businessId: true, cursorAgentId: true },
  });
  if (!session || session.businessId !== businessId) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  const agentRow = await db.query.agents.findFirst({
    where: eq(agents.id, session.agentId),
    columns: { id: true, name: true, isPlatformDefault: true },
    with: { documents: true },
  });
  if (!agentRow) {
    return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
  }

  let soulContent = agentRow.documents.find((d) => d.slug === "soul")?.content ?? "";

  if (agentRow.isPlatformDefault) {
    // Conductor: inject full orchestration snapshot (roster, missions, approvals)
    const snap = await loadConductorOrchestrationSnapshot(businessId);
    soulContent = applyConductorInstructionPlaceholders(soulContent, snap);
  } else {
    // All other agents: prefix with business context + repo snapshot (if GitHub is connected)
    const [bizCtx, repoContext] = await Promise.all([
      buildBusinessContext(businessId),
      buildRepoContextForPrompt(businessId),
    ]);
    const contextParts = [bizCtx.prefix];
    if (repoContext) contextParts.push(repoContext);
    if (soulContent) contextParts.push("---", soulContent);
    soulContent = contextParts.join("\n\n");
    // Store localPath so we can pass it to local.cwd below
    agentLocalPath = bizCtx.localPath;
  }

  // agentLocalPath is set by the non-Conductor branch above; null means no local context
  let agentLocalPath: string | null = null;

  const apiKey = await resolveCursorApiKeyForBusiness(businessId);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "No Cursor API key configured for this workspace" }),
      { status: 402 },
    );
  }

  // Fetch the most recent 20 messages (desc), then reverse to chronological order for the prompt.
  const prevMessages = (
    await db
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(20)
  ).reverse();

  await db.insert(chatMessages).values({ sessionId, role: "user", content: message });
  await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));

  const historyPrefix =
    prevMessages.length > 0
      ? `\n\n## Prior conversation\n` +
        prevMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n\n")
      : "";
  const systemPrompt = soulContent + historyPrefix;
  const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;

  const encoder = new TextEncoder();
  let assistantContent = "";
  let runCompleted = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // Use the business's configured local path (e.g. /Users/.../mercflow) as
      // the agent's workspace. Falls back to no local context if not configured.
      const agentOptions = {
        apiKey,
        model: { id: "composer-2" as const },
        ...(agentLocalPath ? { local: { cwd: agentLocalPath } } : {}),
      };

      let cursorAgent: Awaited<ReturnType<typeof Agent.create>> | null = null;
      try {
        cursorAgent = session.cursorAgentId
          ? await Agent.resume(session.cursorAgentId, agentOptions)
          : await Agent.create(agentOptions);

        send("stage", { label: "Thinking..." });

        const run = await cursorAgent.send(fullPrompt);

        if (!session.cursorAgentId) {
          await db
            .update(chatSessions)
            .set({ cursorAgentId: cursorAgent.agentId, updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        }

        if (run.supports("stream")) {
          for await (const event of run.stream()) {
            if (event.type === "assistant") {
              for (const block of event.message.content) {
                if (block.type === "text") {
                  const delta = block.text;
                  assistantContent += delta;
                  send("text_delta", { delta });
                }
              }
            }
          }
        }

        const result = await run.wait();
        if (result.status === "finished") {
          runCompleted = true;
          send("done", {});
        } else {
          send("error", { message: `Run ended with status: ${result.status}` });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send("error", { message: msg });
      } finally {
        if (cursorAgent) {
          try { await cursorAgent[Symbol.asyncDispose](); } catch { /* ignore */ }
        }
        // Only persist if the run actually completed — avoid storing truncated turns as authoritative history
        if (runCompleted && assistantContent.trim()) {
          await db.insert(chatMessages).values({
            sessionId,
            role: "assistant",
            content: assistantContent,
          });
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
