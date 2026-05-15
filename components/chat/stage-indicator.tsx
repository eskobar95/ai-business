"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function StageIndicator({
  stage,
  active,
}: {
  stage?: string | null;
  /** When false, fades out smoothly. */
  active?: boolean;
}) {
  const [visible, setVisible] = useState(Boolean(stage && active !== false));

  useEffect(() => {
    const on = Boolean(stage && active !== false);
    const t = window.setTimeout(() => setVisible(on), on ? 0 : 200);
    return () => window.clearTimeout(t);
  }, [stage, active]);

  if (!stage || !visible) return null;

  return (
    <div
      className={cn(
        "mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-[opacity,transform] duration-300 ease-out",
        active === false ? "pointer-events-none scale-95 opacity-0" : "opacity-100",
      )}
      aria-live="polite"
    >
      <span className="relative flex size-2">
        <span className="bg-primary/55 absolute inline-flex size-full animate-ping rounded-full" />
        <span className="bg-primary relative inline-flex size-2 rounded-full" />
      </span>
      <span className="text-foreground/90">{stage}</span>
    </div>
  );
}
