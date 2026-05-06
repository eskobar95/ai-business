"use client";

/** Minimal PR status badge until S3 ships the full component. */
export function TaskPrBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span className="inline-flex rounded border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">
      PR: {status}
    </span>
  );
}
