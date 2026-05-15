import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatLayout } from "@/components/chat/chat-layout";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getChatSession } from "@/lib/chat/actions";

export const dynamic = "force-dynamic";

export default async function ChatSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(
    sp.businessId,
    `/dashboard/chats/${sessionId}` as `/dashboard/chats/${string}`,
  );

  let session;
  try {
    session = await getChatSession(sessionId);
  } catch {
    notFound();
  }

  if (session.businessId !== businessId) {
    notFound();
  }

  const initialMessages = session.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: new Date(m.createdAt),
  }));

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/dashboard/chats?businessId=${encodeURIComponent(businessId)}`}
            className="text-muted-foreground hover:text-foreground text-[12px] font-medium transition-colors"
          >
            ← All chats
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="mx-auto flex h-[min(calc(100dvh-9rem),860px)] w-full max-w-6xl min-h-[480px] flex-1 flex-col">
          <ChatLayout
            sessionId={session.id}
            businessId={businessId}
            agentName={session.agent.name}
            agentSlug={session.agent.slug ?? undefined}
            initialMessages={initialMessages}
          />
        </div>
      </div>
    </div>
  );
}
