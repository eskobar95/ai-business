import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/lib/auth/server";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

/** Placeholder until Stream C GitHub App wiring. */
export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const sp = await searchParams;
  await resolveBusinessIdParam(sp.businessId, "/dashboard/settings/integrations");

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Integrations" />
      <div className="flex-1 px-6 py-5">
        <p className="text-[13px] text-muted-foreground">
          GitHub App installation and repository linking will be available here (Stream C). Use{" "}
          <span className="text-foreground">Settings</span> for workspace and MCP configuration in the
          meantime.
        </p>
      </div>
    </div>
  );
}
