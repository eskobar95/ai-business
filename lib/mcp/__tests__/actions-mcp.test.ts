import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  query: {
    mcpCredentials: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: vi.fn(async () => {}),
}));

vi.mock("@/lib/agents/actions", () => ({
  assertUserOwnsAgent: vi.fn(async () => ({ userId: "user-1", businessId: "b1", isPlatformDefault: false })),
}));

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
}));

vi.mock("@/lib/mcp/encryption", () => ({
  encryptCredential: vi.fn(() => ({
    ivBase64: "iv",
    encryptedPayload: { ciphertext: "c", tag: "t" },
  })),
}));

import {
  deleteMcpCredential,
  getMcpCredentialsByBusiness,
  getMcpCredentialsForAgent,
  grantMcpAccessToAgent,
  saveMcpCredential,
} from "../actions";

describe("MCP actions (mocked db)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.insert.mockReturnValue({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: vi.fn(async () => [{ id: "cred-1" }]),
        }),
        onConflictDoNothing: () => Promise.resolve(undefined),
      }),
    });
    mockDb.delete.mockReturnValue({
      where: () => Promise.resolve(undefined),
    });
  });

  it("saveMcpCredential returns credential id", async () => {
    const r = await saveMcpCredential("b1", "github", { token: "x" });
    expect(r.id).toBe("cred-1");
  });

  it("grantMcpAccessToAgent inserts junction row", async () => {
    mockDb.query.mcpCredentials.findFirst.mockResolvedValue({ id: "cred-1" });
    await grantMcpAccessToAgent("agent-1", "cred-1");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("getMcpCredentialsByBusiness runs select chain", async () => {
    const rows = [{ id: "1", mcpName: "notion", createdAt: new Date() }];
    mockDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(rows),
        }),
      }),
    });
    const out = await getMcpCredentialsByBusiness("b1");
    expect(out).toEqual(rows);
  });

  it("getMcpCredentialsForAgent runs select chain", async () => {
    const rows = [{ id: "1", mcpName: "github", createdAt: new Date() }];
    mockDb.select.mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(rows),
          }),
        }),
      }),
    });
    const out = await getMcpCredentialsForAgent("agent-1");
    expect(out).toEqual(rows);
  });

  it("deleteMcpCredential deletes row", async () => {
    mockDb.query.mcpCredentials.findFirst.mockResolvedValue({ businessId: "b1" });
    await deleteMcpCredential("c1");
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
