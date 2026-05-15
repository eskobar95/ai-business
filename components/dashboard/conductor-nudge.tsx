import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";

import { getDb } from "@/db/index";
import { agents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface ConductorNudgeProps {
  businessId: string;
  label?: string;
}

export async function ConductorNudge({
  businessId,
  label = "Spørg Conductor",
}: ConductorNudgeProps) {
  const db = getDb();
  const row = await db.query.agents.findFirst({
    where: and(eq(agents.businessId, businessId), eq(agents.isPlatformDefault, true)),
    columns: { id: true },
  });

  if (!row) {
    return null;
  }

  const href = `/dashboard/agents/${encodeURIComponent(row.id)}?businessId=${encodeURIComponent(businessId)}`;

  return (
    <Link
      href={href}
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
    >
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground/80" aria-hidden>
        <Bot className="size-3.5" />
        <Sparkles className="size-3" />
      </span>
      <span className="min-w-0 leading-snug">{label}</span>
    </Link>
  );
}
