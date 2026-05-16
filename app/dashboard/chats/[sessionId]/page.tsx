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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center border-b border-white/[0.06] px-5">
        <Link
          href={`/dashboard/chats?businessId=${encodeURIComponent(businessId)}`}
          className="text-muted-foreground/60 hover:text-foreground flex items-center gap-1.5 text-[12px] font-medium transition-colors"
        >
          <span aria-hidden>←</span> All chats
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatLayout
          sessionId={session.id}
          businessId={businessId}
          agentName={session.agent.name}
          agentSlug={session.agent.slug ?? undefined}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
