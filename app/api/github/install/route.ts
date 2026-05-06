import { auth } from "@/lib/auth/server";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import {
  encodeGithubInstallBusinessCookie,
  GITHUB_PENDING_INSTALL_COOKIE,
} from "@/lib/github/pending-install-cookie";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Initiates GitHub App installation; sets an HttpOnly workspace binding cookie verified in callback. */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    const origin = req.nextUrl.origin;
    const next = `/dashboard/settings?businessId=${encodeURIComponent(businessId)}&section=integrations`;
    return NextResponse.redirect(
      `${origin}/auth/sign-in?next=${encodeURIComponent(next)}`,
    );
  }

  await assertUserBusinessAccess(session.user.id, businessId);

  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appSlug) {
    return NextResponse.json(
      { error: "GITHUB_APP_SLUG is not configured on the server" },
      { status: 500 },
    );
  }

  const target = new URL(
    `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`,
  );
  const jar = encodeGithubInstallBusinessCookie(businessId);

  const res = NextResponse.redirect(target);
  res.cookies.set(GITHUB_PENDING_INSTALL_COOKIE, jar, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
  return res;
}
