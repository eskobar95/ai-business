import Link from "next/link";

import { cn } from "@/lib/utils";

export type SettingsSectionId =
  | "account"
  | "business"
  | "workspace"
  | "mcp"
  | "webhooks"
  | "integrations";

const ITEMS: { id: SettingsSectionId; label: string; description: string }[] = [
  { id: "account", label: "Cursor", description: "API key & runner integration" },
  { id: "business", label: "Business", description: "Profile, name & identity" },
  { id: "workspace", label: "Workspace", description: "Local path & GitHub" },
  { id: "integrations", label: "Integrations", description: "GitHub App connectivity" },
  { id: "mcp", label: "MCP", description: "GitHub, Notion, Context7" },
  { id: "webhooks", label: "Webhooks", description: "Inbound triggers & log" },
];

export function SettingsSubNav({
  businessId,
  active,
}: {
  businessId: string;
  active: SettingsSectionId;
}) {
  const prefix = `/dashboard/settings?businessId=${encodeURIComponent(businessId)}`;

  return (
    <>
      {ITEMS.map((item) => {
        const href = `${prefix}&section=${item.id}`;
        const isActive = active === item.id;
        return (
          <Link
            key={item.id}
            href={href}
            data-testid={`settings-nav-${item.id}`}
            className={cn(
              "flex flex-col gap-0.5 rounded-md px-3 py-2.5 transition-all duration-150",
              isActive
                ? "bg-white/[0.07] text-foreground"
                : "text-muted-foreground/60 hover:bg-white/[0.04] hover:text-foreground/80",
            )}
          >
            <span className="text-[12.5px] font-medium tracking-[-0.01em]">{item.label}</span>
            <span
              className={cn(
                "text-[11px]",
                isActive ? "text-muted-tier-label" : "text-muted-tier-faint",
              )}
            >
              {item.description}
            </span>
          </Link>
        );
      })}
    </>
  );
}
