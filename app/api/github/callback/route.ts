import { auth } from "@/lib/auth/server";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { finalizeGithubInstallationForBusiness } from "@/lib/github/bootstrap";
import {
  GITHUB_PENDING_INSTALL_COOKIE,
  verifyGithubInstallBusinessCookie,
} from "@/lib/github/pending-install-cookie";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function settingsRedirect(req: NextRequest, businessId: string, qs: Record<string, string>) {
  const origin = req.nextUrl.origin;
  const sp = new URLSearchParams({ businessId, section: "integrations", ...qs });
  return NextResponse.redirect(`${origin}/dashboard/settings?${sp.toString()}`);
}

/**
 * GitHub App **Setup URL** target after install completes.
 * Query: `installation_id`, `setup_action`, optional `state`.
 */
export async function GET(req: NextRequest) {
  const jar = (await cookies()).get(GITHUB_PENDING_INSTALL_COOKIE)?.value;
  const businessId = verifyGithubInstallBusinessCookie(jar);
  const clearCookie = (res: NextResponse) => {
    res.cookies.delete(GITHUB_PENDING_INSTALL_COOKIE);
    return res;
  };

  if (!businessId) {
    return clearCookie(
      NextResponse.redirect(
        `${req.nextUrl.origin}/dashboard/settings?section=integrations&github=missing_context`,
      ),
    );
  }

  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    const next = `/dashboard/settings?businessId=${encodeURIComponent(businessId)}&section=integrations`;
    return clearCookie(
      NextResponse.redirect(
        `${req.nextUrl.origin}/auth/sign-in?next=${encodeURIComponent(next)}`,
      ),
    );
  }

  try {
    await assertUserBusinessAccess(session.user.id, businessId);
  } catch {
    return clearCookie(
      NextResponse.redirect(
        `${req.nextUrl.origin}/dashboard/settings?section=integrations&github=forbidden`,
      ),
    );
  }

  const installationId = req.nextUrl.searchParams.get("installation_id");
  const setupAction = req.nextUrl.searchParams.get("setup_action");

  if (setupAction === "request") {
    return clearCookie(settingsRedirect(req, businessId, { github: "cancelled" }));
  }

  if (!installationId) {
    return clearCookie(settingsRedirect(req, businessId, { github: "no_installation" }));
  }

  try {
    await finalizeGithubInstallationForBusiness({ businessId, installationId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/github/callback] finalize failed:", msg.slice(0, 200));
    return clearCookie(settingsRedirect(req, businessId, { github: "setup_error" }));
  }

  return clearCookie(settingsRedirect(req, businessId, { github: "connected" }));
}
