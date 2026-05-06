import { getDb } from "@/db/index";
import { webhookDeliveries } from "@/db/schema";
import {
  findGithubInstallationRow,
  handlePullRequestEvent,
  parseGithubPullRequestWebhook,
} from "@/lib/github/pr-webhook-handler";
import {
  bufferedGithubWebhookBodyExceedsLimit,
  contentLengthHeaderExceedsGithubWebhookLimit,
} from "@/lib/webhooks/github-webhook-limits";
import { verifySignature } from "@/lib/webhooks/hmac";
import { tryInsertWebhookDelivery } from "@/lib/webhooks/try-insert-webhook-delivery";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/** GitHub sends `sha256=<hex>`; verifySignature expects lowercase hex bytes. */
function githubWebhookSignatureHex(sigHeader: string): string {
  const t = sigHeader.trim();
  const prefixed = /^sha256=(.+)$/i.exec(t);
  return prefixed?.[1] ?? t;
}

function logGithubWebhookWarn(event: string, fields: Record<string, string>): void {
  console.warn(JSON.stringify({ source: "api.github.webhook", level: "warn", event, ...fields }));
}

function payloadTooLarge(): NextResponse {
  return NextResponse.json({ error: "Payload too large" }, { status: 413 });
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

  const cl = req.headers.get("content-length") ?? req.headers.get("Content-Length");
  if (contentLengthHeaderExceedsGithubWebhookLimit(cl)) {
    return payloadTooLarge();
  }

  const rawBody = await req.text();
  if (bufferedGithubWebhookBodyExceedsLimit(Buffer.byteLength(rawBody, "utf8"))) {
    return payloadTooLarge();
  }

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
      logGithubWebhookWarn("pull_request_payload_invalid", {
        deliveryId: idempotencyKey,
        eventType: githubEventType || "unknown",
        reason: parsedPr.reason,
      });
      body = {
        ...body,
        _validationError: parsedPr.reason,
      };
    }
  }

  const outcome = await tryInsertWebhookDelivery({
    businessId: tenantInstallation?.businessId ?? null,
    type: githubEventType || "unknown",
    payload: body,
    idempotencyKey,
    status: "delivered",
    attempts: 1,
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
