import { permanentRedirect } from "next/navigation";

/**
 * Legacy `/dashboard/projects/*` URLs → `/dashboard/missions/*` (301).
 * Preserves path segments after `/dashboard/projects` and query string.
 */
export default async function LegacyProjectsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const sp = await searchParams;
  const suffix = path?.length ? `/${path.join("/")}` : "";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v)) for (const x of v) q.append(k, x);
  }
  const qs = q.toString();
  permanentRedirect(`/dashboard/missions${suffix}${qs ? `?${qs}` : ""}`);
}
