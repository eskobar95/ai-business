import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Redirect legacy /dashboard/settings/integrations route to the main settings integrations section. */
export default async function IntegrationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.businessId
    ? `?businessId=${encodeURIComponent(sp.businessId)}&section=integrations`
    : "?section=integrations";
  redirect(`/dashboard/settings${qs}`);
}
