"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckSquare, ChevronRight, Folder, Plus, Users } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Team = { id: string; name: string };

export function SidebarTeamsGroup({
  teams,
  businessId,
  collapsed,
}: {
  teams: Team[];
  businessId: string | null;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTeamId = searchParams.get("teamId");
  const anyTeamActive = teams.some((t) =>
    pathname.startsWith(`/dashboard/teams/${t.id}`)
  );

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => {
    const active = teams.find((t) =>
      pathname.startsWith(`/dashboard/teams/${t.id}`)
    );
    return active ? new Set([active.id]) : new Set();
  });

  const newHref = businessId
    ? `/dashboard/teams/new?businessId=${encodeURIComponent(businessId)}`
    : "/dashboard/teams/new";

  /* ── Collapsed sidebar: icon only ── */
  if (collapsed) {
    return (
      <button
        type="button"
        title="Teams"
        className={cn(
          "group relative flex w-full cursor-pointer items-center justify-center rounded-md px-2 py-1.5 transition-colors duration-150",
          anyTeamActive
            ? "bg-white/[0.07] text-foreground"
            : "text-muted-foreground/60 hover:bg-white/[0.04] hover:text-foreground/80",
        )}
      >
        <Users className="size-[15px] shrink-0" aria-hidden />
      </button>
    );
  }

  /* ── Expanded sidebar ── */
  return (
    <div>
      {/* Section label */}
      <p className="select-none px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/45">
        Your teams
      </p>

      {/* Team rows */}
      {teams.map((team) => {
        const isActive = pathname.startsWith(`/dashboard/teams/${team.id}`);
        const isExpanded = expandedTeams.has(team.id);
        const teamHref = businessId
          ? `/dashboard/teams/${team.id}?businessId=${encodeURIComponent(businessId)}`
          : `/dashboard/teams/${team.id}`;
        const tasksHref = businessId
          ? `/dashboard/tasks?businessId=${encodeURIComponent(businessId)}&teamId=${encodeURIComponent(team.id)}`
          : `/dashboard/tasks?teamId=${encodeURIComponent(team.id)}`;
        const isThisTeamTasksActive =
          pathname === "/dashboard/tasks" && urlTeamId === team.id;

        return (
          <div key={team.id}>
            {/* Team header row */}
            <div className="group relative flex items-center">
              <Link
                href={teamHref}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md py-1.5 pl-2.5 pr-7 text-[13px] tracking-[-0.01em] transition-all duration-150",
                  isActive
                    ? "bg-white/[0.07] font-medium text-foreground"
                    : "text-foreground/55 hover:bg-white/[0.04] hover:text-foreground/85",
                )}
              >
                <span
                  className={cn(
                    "flex size-[15px] shrink-0 items-center justify-center rounded-[3px] font-mono text-[8px] font-bold",
                    isActive
                      ? "bg-white/[0.14] text-foreground/85"
                      : "bg-white/[0.09] text-foreground/50",
                  )}
                >
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{team.name}</span>
              </Link>

              {/* Expand chevron */}
              <button
                type="button"
                onClick={() =>
                  setExpandedTeams((prev) => {
                    const next = new Set(prev);
                    if (next.has(team.id)) next.delete(team.id);
                    else next.add(team.id);
                    return next;
                  })
                }
                className="absolute right-1.5 flex size-5 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.06]"
                aria-label={isExpanded ? "Collapse team" : "Expand team"}
              >
                <ChevronRight
                  className={cn(
                    "size-3 text-muted-foreground/40 transition-transform duration-150",
                    isExpanded && "rotate-90",
                  )}
                  aria-hidden
                />
              </button>
            </div>

            {/* Sub-items */}
            <div
              className={cn(
                "grid transition-all duration-200 ease-in-out",
                isExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-0.5 pb-1.5 pl-[26px] pt-0.5">
                  <Link
                    href={tasksHref}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors duration-150",
                      isThisTeamTasksActive
                        ? "bg-white/[0.06] text-foreground/80"
                        : "text-foreground/50 hover:bg-white/[0.04] hover:text-foreground/75",
                    )}
                  >
                    <CheckSquare className="size-3 shrink-0 opacity-70" aria-hidden />
                    <span>Issues</span>
                  </Link>
                  <button
                    type="button"
                    disabled
                    className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-foreground/25"
                  >
                    <Folder className="size-3 shrink-0 opacity-50" aria-hidden />
                    <span>Projects</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {teams.length === 0 && (
        <p className="px-2.5 py-1.5 text-[11px] text-foreground/30">
          No teams yet
        </p>
      )}

      {/* New team */}
      <Link
        href={newHref}
        className="mt-0.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-foreground/40 transition-colors duration-150 hover:bg-white/[0.04] hover:text-foreground/65"
      >
        <Plus className="size-3 opacity-70" aria-hidden />
        <span>New team</span>
      </Link>
    </div>
  );
}
