import type { NextRequest } from "next/server";
import { Agent } from "@cursor/sdk";
import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/index";
import { agents, businesses, chatMessages, chatSessions, memory } from "@/db/schema";
// businesses is used in buildBusinessContext
import { auth } from "@/lib/auth/server";
import {
  applyConductorInstructionPlaceholders,
  loadConductorOrchestrationSnapshot,
} from "@/lib/conductor/conductor-context";
import { CursorChatStreamBridge } from "@/lib/chat/chat-sse";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { parseMentionedRepoPaths } from "@/lib/github/mention-paths";
import {
  buildRepoContextForPrompt,
} from "@/lib/github/repo-context";
import {
  listRepoPath,
  MAX_REPO_FILE_BYTES,
  pathLooksLikeAllowedFile,
  readRepoFile,
  RepoFileAccessError,
} from "@/lib/github/repo-files";
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
 */
async function buildBusinessContext(
  businessId: string,
  opts?: { agentSlug?: string | null; gitHubRepoSectionPresent?: boolean },
): Promise<{ prefix: string }> {
  const db = getDb();

  const [biz] = await db
    .select({ name: businesses.name })
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
  const soulText = soulRow[0]?.content ? htmlToPlainText(soulRow[0].content) : "";

  const slug = opts?.agentSlug ?? null;
  const gh = opts?.gitHubRepoSectionPresent === true;
  const isPo = slug === "product_owner";

  const lines: string[] = [`## Your role`];

  if (isPo && gh) {
    lines.push(
      `You are the **Product Owner** for **${businessName}** (server-side agent).`,
      `You have no local filesystem. This prompt may include a static "## GitHub Repository:" snapshot and, when the user names repository paths (for example \`lib/foo.ts\`), a "## Requested files" section with live GitHub content — prefer live requested files over the snapshot when both apply.`,
      `When "## GitHub Repository:" is present, do **not** tell the user to connect GitHub or grant repository access again.`,
      `If you lack codebase detail, say so honestly and ask which paths to inspect.`,
    );
  } else if (!isPo && gh) {
    lines.push(
      `You are working for **${businessName}**.`,
      `You are a server-side AI agent. You have NO access to any local filesystem and cannot call GitHub yourself.`,
      `When a "## GitHub Repository:" section appears below, that snapshot is already loaded — use it; do not tell the user to connect GitHub or grant repo access again.`,
      `Your ONLY source of codebase knowledge is that injected section. If it is missing, say GitHub is not connected for this workspace.`,
      `Do NOT reference any other repository than the one named in the snapshot. If information is not in the prompt, say so honestly.`,
    );
  } else {
    lines.push(
      `You are working for **${businessName}**.`,
      `You are a server-side AI agent. You have NO access to any local filesystem.`,
      `No GitHub repository snapshot is available for this workspace — if the user expects codebase context, explain that GitHub is not connected (Settings → Integrations).`,
      `Do NOT invent repository structure or file contents.`,
    );
  }

  if (isPo) {
    lines.push(
      "",
      "## Mission proposal format (optional)",
      "When you identify a concrete, well-scoped mission opportunity, you MAY append one or more structured blocks at the **end** of your reply.",
      "Each block uses XML-like tags and line-oriented keys exactly like this:",
      "",
      "<mission>",
      "name: Short mission title",
      "goal: Two to five sentences describing scope and outcomes (PRD-style summary).",
      "validationContract: Testable done criteria the team can verify.",
      "projectType: new_project | existing_codebase | feature | bugfix",
      "</mission>",
      "",
      "Rules:",
      "- Emit one block per distinct mission; omit the blocks entirely when unsure.",
      "- Never fabricate missions solely to populate blocks.",
      "- Place `<mission>` blocks only after your main answer so the user reads context first.",
    );
  }

  if (soulText) {
    lines.push(``, `### Business memory`, soulText);
  }

  return { prefix: lines.join("\n") };
}

async function prefetchRepoPathsMarkdown(opts: {
  businessId: string;
  message: string;
  send: (event: string, data: unknown) => void;
}): Promise<{ markdown: string; pathCount: number }> {
  const paths = parseMentionedRepoPaths(opts.message);
  if (paths.length === 0) return { markdown: "", pathCount: 0 };

  let injected = "";
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const toolId = `repo:${i}:${path}`;
    const isFile = pathLooksLikeAllowedFile(path);
    const kind = isFile ? "read" : "list";
    opts.send("repo_tool_start", { id: toolId, path, kind });

    try {
      if (isFile) {
        const { content, truncated } = await readRepoFile(opts.businessId, path);
        injected += `\n### File: \`${path}\`\n\`\`\`\n${content}\n\`\`\`\n`;
        if (truncated) {
          injected += `_Truncated to ${MAX_REPO_FILE_BYTES} bytes._\n`;
        }
        opts.send("repo_tool_result", {
          id: toolId,
          path,
          ok: true,
          kind,
          lines: content.split("\n").length,
        });
      } else {
        const { entries } = await listRepoPath(opts.businessId, path);
        const lines = entries
          .map((entry) => `- ${entry.type === "dir" ? "[dir]" : "[file]"} \`${entry.path}\``)
          .join("\n");
        injected += `\n### Directory: \`${path}\`\n${lines}\n`;
        opts.send("repo_tool_result", {
          id: toolId,
          path,
          ok: true,
          kind,
          lines: entries.length,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof RepoFileAccessError ? e.message : "Fetch failed";
      injected += `\n### ${isFile ? "File" : "Directory"}: \`${path}\`\n_Error: ${msg}_\n`;
      opts.send("repo_tool_result", {
        id: toolId,
        path,
        ok: false,
        kind,
        errorText: msg,
      });
    }
  }

  return { markdown: injected.trim(), pathCount: paths.length };
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
    columns: { id: true, name: true, isPlatformDefault: true, slug: true },
    with: { documents: true },
  });
  if (!agentRow) {
    return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });
  }

  let soulContent = agentRow.documents.find((d) => d.slug === "soul")?.content ?? "";

  let gitHubRepoConnected = false;

  if (agentRow.isPlatformDefault) {
    // Conductor: inject full orchestration snapshot (roster, missions, approvals)
    const snap = await loadConductorOrchestrationSnapshot(businessId);
    soulContent = applyConductorInstructionPlaceholders(soulContent, snap);
  } else {
    const repoContext = await buildRepoContextForPrompt(businessId);
    gitHubRepoConnected = !!repoContext;
    const bizCtx = await buildBusinessContext(businessId, {
      agentSlug: agentRow.slug,
      gitHubRepoSectionPresent: gitHubRepoConnected,
    });
    const contextParts = [bizCtx.prefix];
    if (repoContext) contextParts.push(repoContext);
    else contextParts.push(`\n> No GitHub repository connected. Connect one in Settings → Integrations.`);
    if (soulContent) contextParts.push("---", soulContent);
    soulContent = contextParts.join("\n\n");
  }

  const isProductOwnerChat =
    !agentRow.isPlatformDefault && agentRow.slug === "product_owner";

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

  const encoder = new TextEncoder();
  let assistantContent = "";
  let runCompleted = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // No local.cwd — codebase context is injected via the prompt from GitHub API.
      // This makes the platform fully server-deployable without local checkouts.
      const agentOptions = {
        apiKey,
        model: { id: "composer-2" as const },
      };

      let cursorAgent: Awaited<ReturnType<typeof Agent.create>> | null = null;
      const bridge = new CursorChatStreamBridge((event, data) => send(event, data));

      try {
        bridge.stage("Context ready");
        bridge.stage(
          session.cursorAgentId ? "Resuming agent session" : "Starting agent session",
        );

        cursorAgent = session.cursorAgentId
          ? await Agent.resume(session.cursorAgentId, agentOptions)
          : await Agent.create(agentOptions);

        bridge.stage("Connected to agent");
        bridge.stage("Processing your message");

        let repoInject = "";
        if (isProductOwnerChat && gitHubRepoConnected) {
          bridge.stage("Fetching repository paths");
          const { markdown: fetched, pathCount } = await prefetchRepoPathsMarkdown({
            businessId,
            message,
            send,
          });
          if (pathCount > 0 && fetched) {
            repoInject =
              `\n\n## Requested files (live from GitHub — ground answers in this section)\n${fetched}\n\n` +
              `The static "## GitHub Repository:" snapshot above may be stale; prefer these blocks when both exist.\n` +
              `Never tell the user to "connect GitHub" — the repository is already linked.\n`;
          } else if (pathCount === 0) {
            repoInject =
              `\n\n## Repository file access\n` +
              `When the user asks about specific implementation files, ask them to name repository paths ` +
              `(e.g. \`lib/missions/actions.ts\`) so the platform can fetch live content into this prompt.\n` +
              `Never tell the user to "connect GitHub" when a "## GitHub Repository:" section appears above — the integration is already active.\n`;
          }
        }

        const fullPrompt = `${systemPrompt}${repoInject}\n\nUser: ${message}\n\nAssistant:`;

        const run = await cursorAgent.send(fullPrompt);

        if (!session.cursorAgentId) {
          await db
            .update(chatSessions)
            .set({ cursorAgentId: cursorAgent.agentId, updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        }

        if (run.supports("stream")) {
          for await (const event of run.stream()) {
            assistantContent += bridge.handleMessage(event);
          }
        } else {
          bridge.stage("Waiting for response");
        }

        bridge.endThinking();

        const result = await run.wait();
        if (!assistantContent.trim() && result.result?.trim()) {
          bridge.stage("Writing response");
          send("text_delta", { delta: result.result });
          assistantContent = result.result;
        }
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
