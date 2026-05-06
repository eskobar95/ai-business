import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { user: { id: "user-test-id" } },
    }),
  },
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cursor/agent", () => ({
  runCursorAgent: vi.fn(async () => {
    async function* chunks() {
      yield "chunk-token";
    }
    return chunks();
  }),
}));

vi.mock("@/lib/settings/cursor-api-key", () => ({
  getUserCursorApiKeyDecrypted: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db/index", () => ({
  getDb: () => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  }),
}));

describe("GET /api/grill-me/stream", () => {
  it(
    "responds with SSE content-type and at least one data line",
    async () => {
      const mod = await import("@/app/api/grill-me/stream/route");
      const req = new NextRequest(
        "http://localhost/api/grill-me/stream?businessId=biz-111",
        { method: "GET" },
      );
      const res = await mod.GET(req);
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/i);
      const txt = await new Response(res.body).text();
      expect(txt).toContain("data: ");
    },
    20_000,
  );
});
