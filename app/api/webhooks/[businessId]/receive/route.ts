import { getDb } from "@/db/index";
import { webhookDeliveries } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { verifySignature } from "@/lib/webhooks/hmac";
import { tryInsertWebhookDelivery } from "@/lib/webhooks/try-insert-webhook-delivery";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;

  const idem = req.headers.get("x-idempotency-key") ?? req.headers.get("X-Idempotency-Key");
  if (!idem?.trim()) {
    return NextResponse.json({ error: "X-Idempotency-Key header is required" }, { status: 400 });
  }
  const idempotencyKey = idem.trim();

  const sigHeader =
    req.headers.get("x-webhook-signature") ?? req.headers.get("X-Webhook-Signature");
  if (!sigHeader?.trim()) {
    return NextResponse.json({ error: "X-Webhook-Signature header is required" }, { status: 401 });
  }

  const rawBody = await req.text();
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook verification not configured" }, { status: 500 });
  }

  if (!verifySignature(rawBody, sigHeader.trim(), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.idempotencyKey, idempotencyKey),
    columns: { id: true },
  });
  if (existing) {
    return new NextResponse(null, { status: 202 });
  }

  const eventType = typeof body.event_type === "string" ? body.event_type : "unknown";

  const insertOutcome = await tryInsertWebhookDelivery({
    businessId,
    type: eventType,
    payload: body,
    idempotencyKey,
    status: "delivered",
    attempts: 1,
  });
  if (insertOutcome === "duplicate") {
    return new NextResponse(null, { status: 202 });
  }

  await logEvent({
    type: "webhook_trigger",
    businessId,
    payload: { event_type: eventType, body },
    status: "pending",
  });

  return new NextResponse(null, { status: 202 });
}
