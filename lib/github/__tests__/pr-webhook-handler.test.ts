import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifySignatureMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/webhooks/hmac", () => ({
  verifySignature: verifySignatureMock,
}));

const logEventMock = vi.hoisted(() => vi.fn(async () => "evt-1"));

vi.mock("@/lib/orchestration/events", () => ({
  logEvent: logEventMock,
}));

const mockDb = vi.hoisted(() => ({
  query: {
    webhookDeliveries: {
      findFirst: vi.fn(),
    },
    githubInstallations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    businesses: {
      findFirst: vi.fn(),
    },
    tasks: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
}));

const selectLimitMock = vi.hoisted(() => vi.fn());

function wireJsonbInstallSelectMock() {
  selectLimitMock.mockReset();
  selectLimitMock.mockResolvedValue([]);
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: selectLimitMock,
      }),
    }),
  });
}

const INSTALL_UUID = "00000000-0000-4000-a000-000000000099";
const BIZ_UUID = "00000000-0000-4000-a000-000000000088";

function installationRow(): {
  id: string;
  businessId: string;
  installationId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  repos: string[];
  tokenIv: string | null;
  tokenEncrypted: unknown | null;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: INSTALL_UUID,
    businessId: BIZ_UUID,
    installationId: "12345",
    accountLogin: "acme-corp",
    accountType: "Organization",
    repos: ["acme/app"],
    tokenIv: null,
    tokenEncrypted: null,
    tokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function basePayload(opts?: Partial<{ action: string; merged: boolean; baseRef: string }>): {
  action: string;
  number: number;
  pull_request: { merged: boolean; base: { ref: string }; head: { ref: string } };
  repository: { full_name: string };
  installation: { id: number };
} {
  const o = opts ?? {};
  return {
    action: o.action ?? "opened",
    number: 42,
    pull_request: {
      merged: o.merged ?? false,
      base: { ref: o.baseRef ?? "integration" },
      head: { ref: "feature/x" },
    },
    repository: { full_name: "acme/app" },
    installation: { id: 12345 },
  };
}

describe("parseGithubPullRequestWebhook", () => {
  it("accepts minimal valid shape", async () => {
    const { parseGithubPullRequestWebhook } = await import("@/lib/github/pr-webhook-handler");
    const body = basePayload() as unknown as Record<string, unknown>;
    const r = parseGithubPullRequestWebhook(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.number).toBe(42);
  });

  it("rejects missing number", async () => {
    const { parseGithubPullRequestWebhook } = await import("@/lib/github/pr-webhook-handler");
    const b = { ...basePayload(), number: "nope" } as unknown as Record<string, unknown>;
    const r = parseGithubPullRequestWebhook(b);
    expect(r.ok).toBe(false);
  });
});

describe("findGithubInstallationRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireJsonbInstallSelectMock();
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
  });

  it("uses jsonb repos containment when installation lookup misses", async () => {
    selectLimitMock.mockResolvedValue([installationRow()]);
    const { findGithubInstallationRow } = await import("@/lib/github/pr-webhook-handler");
    // Mock neon Drizzle client (getDb replacement in tests).
    // @ts-expect-error test double mirrors ReturnType<typeof getDb>
    const row = await findGithubInstallationRow(mockDb, {
      repository: { full_name: "acme/app" },
      installation: { id: 33333 },
    });
    expect(row?.id).toBe(INSTALL_UUID);
  });
});

describe("handlePullRequestEvent", () => {
  const setMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    verifySignatureMock.mockReturnValue(true);
    wireJsonbInstallSelectMock();
    mockDb.query.webhookDeliveries.findFirst.mockResolvedValue(null);
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
    mockDb.query.githubInstallations.findMany.mockResolvedValue([]);
    mockDb.query.businesses.findFirst.mockResolvedValue(undefined);
    mockDb.query.tasks.findMany.mockResolvedValue([]);
    mockDb.insert.mockImplementation(() => ({
      values: () => Promise.resolve(undefined),
    }));
    setMock.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));
    mockDb.update.mockImplementation(() => ({
      set: setMock,
    }));
  });

  it("updates githubPrStatus to 'open' on action=opened", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      {
        id: "task-1",
        githubPrNumber: 42,
        githubRepoInstallationId: INSTALL_UUID,
      },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(basePayload({ action: "opened" }));

    expect(mockDb.update).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ githubPrStatus: "open" }));
  });

  it("updates githubPrStatus to 'draft' on action=converted_to_draft", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-1", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(basePayload({ action: "converted_to_draft" }));

    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ githubPrStatus: "draft" }));
  });

  it("updates githubPrStatus to 'merged' and sets prMergedToIntegration=true when merged to integrationBranch", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-1", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(
      basePayload({ action: "closed", merged: true, baseRef: "integration" }),
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        githubPrStatus: "merged",
        prMergedToIntegration: true,
        gatesLockedAt: expect.any(Date),
      }),
    );
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "github.pr.merged",
        businessId: BIZ_UUID,
        correlationKey: `github-pr-${INSTALL_UUID}-42`,
      }),
    );
  });

  it("does NOT set prMergedToIntegration when merged to a different branch", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-1", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(
      basePayload({ action: "closed", merged: true, baseRef: "main" }),
    );

    const updateArg = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(updateArg?.githubPrStatus).toBe("merged");
    expect(updateArg?.prMergedToIntegration).toBeUndefined();
    expect(updateArg?.gatesLockedAt).toBeUndefined();
  });

  it("updates githubPrStatus to 'closed' when closed without merge", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-1", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(basePayload({ action: "closed", merged: false }));

    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ githubPrStatus: "closed" }));
  });

  it("ignores unknown repository (no installation match)", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
    mockDb.query.githubInstallations.findMany.mockResolvedValue([]);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(basePayload());

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("handles task with no matching githubPrNumber gracefully", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "integration" });
    mockDb.query.tasks.findMany.mockResolvedValue([]);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(basePayload());

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("logs github.pr.merged event when merged to integrationBranch", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "staging" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-merge", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(
      basePayload({ action: "closed", merged: true, baseRef: "staging" }),
    );

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "github.pr.merged",
        payload: expect.objectContaining({ prNumber: 42 }),
      }),
    );
  });

  it("does NOT log event when merged to non-integration branch", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    mockDb.query.businesses.findFirst.mockResolvedValue({ integrationBranch: "staging" });
    mockDb.query.tasks.findMany.mockResolvedValue([
      { id: "task-merge", githubPrNumber: 42, githubRepoInstallationId: INSTALL_UUID },
    ] as never);

    const { handlePullRequestEvent } = await import("@/lib/github/pr-webhook-handler");
    await handlePullRequestEvent(
      basePayload({ action: "closed", merged: true, baseRef: "main" }),
    );

    expect(logEventMock).not.toHaveBeenCalled();
  });
});

function githubWebhookSignature(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function githubHeaders(body: Record<string, unknown>, event: string, delivery: string): Headers {
  const raw = JSON.stringify(body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "gh-test-secret";
  const sig = `sha256=${githubWebhookSignature(secret, raw)}`;
  return new Headers({
    "Content-Type": "application/json",
    "X-Hub-Signature-256": sig,
    "X-GitHub-Event": event,
    "X-GitHub-Delivery": delivery,
  });
}

describe("POST /api/github/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = "gh-test-secret";
    verifySignatureMock.mockReturnValue(true);
    wireJsonbInstallSelectMock();
    mockDb.query.webhookDeliveries.findFirst.mockResolvedValue(null);
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
    mockDb.query.githubInstallations.findMany.mockResolvedValue([]);
    mockDb.insert.mockImplementation(() => ({
      values: () => Promise.resolve(undefined),
    }));
  });

  it("returns 401 on invalid HMAC signature", async () => {
    verifySignatureMock.mockReturnValue(false);
    const mod = await import("@/app/api/github/webhook/route");
    const headers = githubHeaders({}, "ping", "del-401");
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers,
      body: "{}",
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when x-hub-signature-256 header is missing", async () => {
    const mod = await import("@/app/api/github/webhook/route");
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: new Headers({
        "X-GitHub-Event": "ping",
        "X-GitHub-Delivery": "del-miss-sig",
      }),
      body: "{}",
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when x-github-delivery header is missing", async () => {
    const mod = await import("@/app/api/github/webhook/route");
    const raw = "{}";
    const sig = `sha256=${githubWebhookSignature("gh-test-secret", raw)}`;
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sig,
        "X-GitHub-Event": "ping",
      }),
      body: raw,
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 202 for duplicate delivery (idempotency)", async () => {
    mockDb.query.webhookDeliveries.findFirst.mockResolvedValue({ id: "prior" });
    const mod = await import("@/app/api/github/webhook/route");
    const body = { installation: { id: 1 } };
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: githubHeaders(body, "ping", "del-dup"),
      body: JSON.stringify(body),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(202);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 200 for ping event", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    const mod = await import("@/app/api/github/webhook/route");
    const body = { zen: "x", hook_id: 1, installation: { id: 12345 } };
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: githubHeaders(body, "ping", "del-ping"),
      body: JSON.stringify(body),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("returns 202 for unhandled event types", async () => {
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(installationRow());
    const mod = await import("@/app/api/github/webhook/route");
    const body = { action: "created", installation: { id: 12345 } };
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: githubHeaders(body, "issues", "del-issues"),
      body: JSON.stringify(body),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(202);
  });

  it("returns 422 for malformed pull_request and persists delivery with null businessId", async () => {
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockImplementation(() => ({ values: valuesSpy }));
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
    const mod = await import("@/app/api/github/webhook/route");
    const body = { action: "opened", installation: { id: 1 } };
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: githubHeaders(body, "pull_request", "del-bad-pr"),
      body: JSON.stringify(body),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(422);
    const json = (await res.json()) as { reason?: string };
    expect(json.reason).toBeDefined();
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: null,
        type: "pull_request",
        payload: expect.objectContaining({ _validationError: expect.any(String) }),
      }),
    );
  });

  it("returns 200 for ping and persists with null businessId when installation unknown", async () => {
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockImplementation(() => ({ values: valuesSpy }));
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);
    const mod = await import("@/app/api/github/webhook/route");
    const body = { zen: "x" };
    const req = new NextRequest("http://localhost/api/github/webhook", {
      method: "POST",
      headers: githubHeaders(body, "ping", "del-ping-null"),
      body: JSON.stringify(body),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: null, type: "ping" }),
    );
  });
});
