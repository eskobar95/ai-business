import { getDb } from "@/db/index";
import { webhookDeliveries } from "@/db/schema";
import {
  findGithubInstallationRow,
  handlePullRequestEvent,
  parseGithubPullRequestWebhook,
} from "@/lib/github/pr-webhook-handler";
import { verifySignature } from "@/lib/webhooks/hmac";
import { isPostgresUniqueViolation } from "@/lib/webhooks/pg-errors";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/** GitHub sends `sha256=<hex>`; verifySignature expects lowercase hex bytes. */
function githubWebhookSignatureHex(sigHeader: string): string {
  const t = sigHeader.trim();
  const prefixed = /^sha256=(.+)$/i.exec(t);
  return prefixed?.[1] ?? t;
}

async function persistDelivery(opts: {
  businessId: string | null;
  githubEventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<"inserted" | "duplicate"> {
  const db = getDb();
  try {
    await db.insert(webhookDeliveries).values({
      businessId: opts.businessId ?? null,
      type: opts.githubEventType,
      payload: opts.payload,
      status: "delivered",
      idempotencyKey: opts.idempotencyKey,
      attempts: 1,
    });
    return "inserted";
  } catch (err) {
    if (isPostgresUniqueViolation(err)) return "duplicate";
    throw err;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sigHeader =
    req.headers.get("x-hub-signature-256") ??
    req.headers.get("X-Hub-Signature-256") ??
    "";
  const githubEventType =
    req.headers.get("x-github-event") ?? req.headers.get("X-GitHub-Event") ?? "";
  const deliveryId =
    req.headers.get("x-github-delivery") ?? req.headers.get("X-GitHub-Delivery") ?? "";

  if (!sigHeader.trim()) {
    return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
  }
  if (!deliveryId.trim()) {
    return NextResponse.json({ error: "Missing GitHub-Delivery header" }, { status: 400 });
  }

  const idempotencyKey = deliveryId.trim();
  const rawBody = await req.text();

  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const hexSig = githubWebhookSignatureHex(sigHeader);
  if (!verifySignature(rawBody, hexSig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getDb();
  const existing = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.idempotencyKey, idempotencyKey),
    columns: { id: true },
  });
  if (existing) {
    return new NextResponse(null, { status: 202 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantInstallation = await findGithubInstallationRow(db, body);

  let parsedPr = null as ReturnType<typeof parseGithubPullRequestWebhook> | null;
  let pullRequestMalformed = false;

  if (githubEventType === "pull_request") {
    parsedPr = parseGithubPullRequestWebhook(body);
    if (parsedPr.ok) {
      await handlePullRequestEvent(parsedPr.payload, { cachedInstallation: tenantInstallation });
    } else {
      pullRequestMalformed = true;
      console.warn("[github webhook] Invalid pull_request JSON shape:", parsedPr.reason);
      body = {
        ...body,
        _validationError: parsedPr.reason,
      };
    }
  }

  const outcome = await persistDelivery({
    businessId: tenantInstallation?.businessId ?? null,
    githubEventType: githubEventType || "unknown",
    payload: body,
    idempotencyKey,
  });
  if (outcome === "duplicate") {
    return new NextResponse(null, { status: 202 });
  }

  if (pullRequestMalformed && parsedPr && !parsedPr.ok) {
    return NextResponse.json({ error: "Invalid pull_request payload", reason: parsedPr.reason }, {
      status: 422,
    });
  }

  if (githubEventType === "ping") {
    return NextResponse.json({ ok: true });
  }

  if (githubEventType === "pull_request") {
    return NextResponse.json({ ok: true });
  }

  return new NextResponse(null, { status: 202 });
}
