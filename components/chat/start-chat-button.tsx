"use client";

import { MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createChatSession } from "@/lib/chat/actions";
import { cn } from "@/lib/utils";

export function StartChatButton({
  businessId,
  agentId,
}: {
  businessId: string;
  agentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { id } = await createChatSession(businessId, agentId);
      router.push(`/dashboard/chats/${id}?businessId=${encodeURIComponent(businessId)}`);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5",
        "text-[12px] font-medium text-muted-foreground/70 transition-all",
        "hover:border-primary/30 hover:bg-primary/8 hover:text-primary/80",
        "disabled:cursor-wait disabled:opacity-50",
      )}
    >
      <MessageSquarePlus className="size-3.5" />
      {isPending ? "Starting…" : "New chat"}
    </button>
  );
}
