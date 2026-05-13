"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Share2,
  X,
} from "lucide-react";
import { SignedIn, SignedOut } from "@neondatabase/auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { SidebarTeamsGroup } from "@/components/sidebar-teams-group";

import { NavNewBusinessButton } from "./nav-new-business-button";

const SIDEBAR_COLLAPSED_KEY = "ai-business-sidebar-collapsed";

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  pendingApprovalsCount,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  collapsed: boolean;
  pendingApprovalsCount?: number;
}) {
  const showBadge =
    href === "/dashboard/approvals" && (pendingApprovalsCount ?? 0) > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-2 pl-2.5 text-[13px] transition-all duration-150",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-white/[0.07] font-medium text-foreground"
          : "text-muted-tier-label hover:bg-white/[0.04] hover:text-foreground/80",
      )}
      title={collapsed ? label : undefined}
    >
      <Icon
        className={cn(
          "size-[15px] shrink-0 transition-colors duration-150",
          isActive
            ? "text-foreground/70"
            : "text-muted-tier-label group-hover:text-foreground/60",
        )}
        aria-hidden
      />
      {!collapsed && (
        <span className="flex-1 truncate tracking-[-0.01em]">{label}</span>
      )}
      {showBadge && (
        <span
          data-testid="nav-approvals-pending-count"
          className={cn(
            "ml-auto inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-400/15 px-1 py-0.5 font-mono text-[10px] font-medium leading-none text-amber-400",
            collapsed && "absolute -right-0.5 -top-0.5 ml-0",
          )}
        >
          {(pendingApprovalsCount ?? 0) > 99 ? "99+" : pendingApprovalsCount}
        </span>
      )}
    </Link>
  );
}

function UserAvatar({ email }: { email: string | null }) {
  const initials = email
    ? email.split("@")[0].slice(0, 2).toUpperCase()
    : "?";
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-[10px] font-semibold text-foreground/80">
      {initials}
    </span>
  );
}

export function AppSidebar({
  pendingApprovalsCount = 0,
  userEmail,
  teams = [],
  businessId = null,
}: {
  pendingApprovalsCount?: number;
  userEmail?: string | null;
  teams?: { id: string; name: string }[];
  businessId?: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(e.target as Node)
      ) {
        setWorkspaceOpen(false);
      }
    }
    if (workspaceOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [workspaceOpen]);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const sidebarInner = (
    <>
      {/* Workspace header — h-14 matches page header */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-1.5 border-b border-sidebar-border pl-2 pr-3",
          collapsed && "justify-center",
        )}
      >
        <div
          className={cn("relative min-w-0 flex-1", collapsed && "flex-initial")}
          ref={workspaceRef}
        >
          <button
            type="button"
            onClick={() => setWorkspaceOpen((o) => !o)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.04]",
              collapsed && "justify-center p-2",
            )}
            aria-expanded={workspaceOpen}
            aria-haspopup="true"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-white/[0.12] text-[9px] font-bold tracking-wider text-foreground/70">
              AI
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground/90">
                  Workspace
                </span>
                <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>

          {workspaceOpen && !collapsed && (
            <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 text-sm shadow-xl shadow-black/40">
              {userEmail && (
                <div className="mb-1 border-b border-white/[0.06] px-2 py-2">
                  <p className="section-label">Signed in as</p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-foreground">
                    {userEmail}
                  </p>
                </div>
              )}
              <Link
                href="/dashboard/onboarding"
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-white/[0.05]"
                onClick={() => setWorkspaceOpen(false)}
              >
                <Plus className="size-3.5" />
                New workspace
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-white/[0.05]"
                onClick={() => setWorkspaceOpen(false)}
              >
                <Settings className="size-3.5" />
                Settings
              </Link>
              <div className="my-1 border-t border-white/[0.06]" />
              <Link
                href="/auth/sign-out"
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-destructive/80 transition-colors hover:bg-destructive/10"
                onClick={() => setWorkspaceOpen(false)}
              >
                <LogOut className="size-3.5" />
                Sign out
              </Link>
            </div>
          )}
        </div>

        {!collapsed && <NavNewBusinessButton />}
      </div>

      {/* Nav */}
      <nav
        className="flex flex-1 flex-col overflow-y-auto p-2 pt-2"
        aria-label="Primary"
      >
        {/* Section 1: Dashboard, Agents, Inbox — no label */}
        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            collapsed={collapsed}
            isActive={isActive("/dashboard")}
          />
          <NavItem
            href="/dashboard/agents"
            label="Agents"
            icon={Bot}
            collapsed={collapsed}
            isActive={isActive("/dashboard/agents")}
          />
          <NavItem
            href="/dashboard/communication"
            label="Communication"
            icon={Share2}
            collapsed={collapsed}
            isActive={isActive("/dashboard/communication")}
          />
          <NavItem
            href="/dashboard/missions"
            label="Missions"
            icon={FolderKanban}
            collapsed={collapsed}
            isActive={isActive("/dashboard/missions")}
          />
          <NavItem
            href="/dashboard/approvals"
            label="Inbox"
            icon={Inbox}
            collapsed={collapsed}
            isActive={isActive("/dashboard/approvals")}
            pendingApprovalsCount={pendingApprovalsCount}
          />
        </div>

        {/* Teams section — SidebarTeamsGroup renders its own "YOUR TEAMS" label */}
        <SidebarTeamsGroup
          teams={teams}
          businessId={businessId}
          collapsed={collapsed}
        />

        {/* Workspace section */}
        {!collapsed && (
          <p className="select-none px-2.5 pb-1.5 pt-4 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/45">
            Workspace
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/dashboard/skills"
            label="Skills"
            icon={BookOpen}
            collapsed={collapsed}
            isActive={isActive("/dashboard/skills")}
          />
          <NavItem
            href="/dashboard/settings"
            label="Settings"
            icon={Settings}
            collapsed={collapsed}
            isActive={isActive("/dashboard/settings")}
          />
        </div>
      </nav>

      {/* Bottom: user account + version + support + collapse */}
      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border p-2 pt-2">
        <SignedIn>
          <div
            className={cn(
              "text-muted-tier-label hover:text-foreground/80 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/[0.04]",
              collapsed && "justify-center px-2",
            )}
          >
            <UserAvatar email={userEmail ?? null} />
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-[12px] tracking-[-0.01em]">
                {userEmail?.split("@")[0] ?? "Account"}
              </span>
            )}
          </div>
        </SignedIn>

        <SignedOut>
          <Link
            href="/auth/sign-in"
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground",
              collapsed && "justify-center",
            )}
          >
            <LogOut className="size-[15px] shrink-0" />
            {!collapsed && <span>Sign in</span>}
          </Link>
        </SignedOut>

        {/* Version + support — only when expanded */}
        {!collapsed && (
          <>
            <div className="px-2.5 py-0.5">
              <span className="font-mono text-[9.5px] text-muted-foreground/20">
                v0.1.0
              </span>
            </div>
            <button
              disabled
              type="button"
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1 text-[12px] text-muted-foreground/25"
            >
              <HelpCircle className="size-[13px]" />
              <span>Support</span>
            </button>
          </>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-tier-label transition-colors duration-150 hover:text-muted-tier-secondary",
            collapsed && "justify-center px-2",
          )}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <>
              <ChevronLeft className="size-3.5" />
              <span className="text-[11px] tracking-wide">Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile/tablet top bar */}
      <div className="fixed top-0 right-0 left-0 z-40 flex h-12 items-center border-b border-border bg-background px-3 lg:hidden">
        <button
          type="button"
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
        <Link
          href="/dashboard"
          className="ml-2 text-sm font-semibold tracking-[-0.01em] text-foreground/90"
        >
          AI Business
        </Link>
      </div>

      {/* Mobile/tablet overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-svh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "fixed top-0 left-0 z-50 lg:relative lg:z-0",
          "transition-[transform,width] duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          hydrated && collapsed ? "w-14" : "w-[280px]",
        )}
      >
        {/* Mobile/tablet close row */}
        <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-3 lg:hidden">
          <span className="text-[13px] font-medium text-foreground/80">
            Menu
          </span>
          <button
            type="button"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {sidebarInner}
      </aside>
    </>
  );
}
