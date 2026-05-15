"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/communication", label: "Communication" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/teams", label: "Teams" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/skills", label: "Skills" },
  { href: "/dashboard/approvals", label: "Approvals" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function NavLinks({ pendingApprovalsCount = 0 }: { pendingApprovalsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm"
    >
      {links.map(({ href, label }) => {
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/dashboard/settings" && pathname.startsWith("/dashboard/settings"));

        return (
          <Link
            key={href}
            href={href}
            className={
              isActive
                ? "text-foreground border-foreground inline-flex items-center gap-1 border-b-2 pb-0.5 text-sm font-medium"
                : "hover:text-foreground inline-flex items-center gap-1 transition-colors"
            }
          >
            {label}
            {href === "/dashboard/approvals" && pendingApprovalsCount > 0 ? (
              <span
                data-testid="nav-approvals-pending-count"
                className="bg-primary text-primary-foreground inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              >
                {pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
