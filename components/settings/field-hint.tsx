"use client";

import { CircleHelp } from "lucide-react";

export function FieldHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex cursor-help text-muted-foreground/40"
      title={text}
      aria-label={text}
    >
      <CircleHelp className="size-3.5" />
    </span>
  );
}
