"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "instructions" | "skills" | "routines" | "mcp" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "instructions", label: "Instructions" },
  { id: "skills", label: "Skills" },
  { id: "routines", label: "Routines" },
  { id: "mcp", label: "MCP" },
  { id: "settings", label: "Settings" },
];

export function AgentDetailTabs({
  overview,
  instructions,
  skills,
  routines,
  mcp,
  settings,
}: {
  overview: ReactNode;
  instructions: ReactNode;
  skills: ReactNode;
  routines: ReactNode;
  mcp: ReactNode;
  settings: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("overview");

  const content: Record<Tab, ReactNode> = {
    overview,
    instructions,
    skills,
    routines,
    mcp,
    settings,
  };

  return (
    <div className="flex flex-col">
      {/* Underline tab bar — Paperclip/Supabase style */}
      <div className="flex border-b border-white/[0.07] px-6" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "relative mr-1 cursor-pointer px-3 py-3 text-[13px] transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
              "before:absolute before:bottom-0 before:left-0 before:right-0 before:h-[2px] before:rounded-t-full before:transition-all before:duration-150",
              active === tab.id
                ? "text-foreground font-medium before:bg-primary"
                : "text-muted-foreground hover:text-foreground before:bg-transparent",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {content[active]}
      </div>
    </div>
  );
}
