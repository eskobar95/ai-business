import { beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateSeedError } from "@/lib/templates/template-errors";

import { seedEnterpriseTemplateAction } from "../seed-action";

const mocks = vi.hoisted(() => ({
  requireSessionUserId: vi.fn(),
  assertUserBusinessAccess: vi.fn(),
  getDb: vi.fn(),
  readFileSync: vi.fn(),
  verifyAndParseBundle: vi.fn(),
  seedEnterpriseTemplate: vi.fn(),
}));

vi.mock("@/lib/roster/session", () => ({
  requireSessionUserId: mocks.requireSessionUserId,
}));

vi.mock("@/lib/grill-me/access", () => ({
  assertUserBusinessAccess: mocks.assertUserBusinessAccess,
}));

vi.mock("@/db/index", () => ({
  getDb: mocks.getDb,
}));

vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => mocks.readFileSync(...args) as string,
}));

vi.mock("@/lib/templates/bundle-verify", () => ({
  verifyAndParseBundle: (raw: unknown) => mocks.verifyAndParseBundle(raw),
}));

vi.mock("@/lib/templates/seed-enterprise-template", () => ({
  seedEnterpriseTemplate: (...args: unknown[]) => mocks.seedEnterpriseTemplate(...args),
}));

function dbForBusinessLookup(rows: { templateSeeded: boolean }[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(rows),
        }),
      }),
    }),
  };
}

/** Matches `countSeededRows` order: teams, agents, edges, gates. */
function dbForSequentialCounts(counts: [number, number, number, number]) {
  let i = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ n: counts[i++] ?? 0 }]),
      }),
    }),
  };
}

describe("seedEnterpriseTemplateAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSessionUserId.mockResolvedValue("user-1");
    mocks.assertUserBusinessAccess.mockResolvedValue(undefined);
  });

  it("returns sign-in error when session helper throws Unauthorized", async () => {
    mocks.requireSessionUserId.mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await seedEnterpriseTemplateAction("biz-1");

    expect(result).toEqual({ ok: false, error: "You must be signed in." });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns not found when business row is missing", async () => {
    mocks.getDb.mockReturnValue(dbForBusinessLookup([]));

    const result = await seedEnterpriseTemplateAction("biz-missing");

    expect(result).toEqual({ ok: false, error: "Business not found." });
  });

  it("returns counts when template was already seeded", async () => {
    mocks.getDb
      .mockReturnValueOnce(dbForBusinessLookup([{ templateSeeded: true }]))
      .mockReturnValueOnce(dbForSequentialCounts([2, 11, 4, 1]));

    const result = await seedEnterpriseTemplateAction("biz-1");

    expect(result).toEqual({
      ok: true,
      alreadySeeded: true,
      teams: 2,
      agents: 11,
      edges: 4,
      gates: 1,
    });
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });

  it("reads bundle, parses, and applies template when not yet seeded", async () => {
    const fakeDb = dbForBusinessLookup([{ templateSeeded: false }]);
    mocks.getDb.mockReturnValue(fakeDb);
    mocks.readFileSync.mockReturnValueOnce("{}");
    mocks.verifyAndParseBundle.mockReturnValueOnce({ mocked: true } as never);
    mocks.seedEnterpriseTemplate.mockResolvedValueOnce({
      teams: 1,
      agents: 2,
      edges: 3,
      gates: 4,
    });

    const result = await seedEnterpriseTemplateAction("biz-1");

    expect(result).toEqual({
      ok: true,
      alreadySeeded: false,
      teams: 1,
      agents: 2,
      edges: 3,
      gates: 4,
    });
    expect(mocks.verifyAndParseBundle).toHaveBeenCalledWith({});
    expect(mocks.seedEnterpriseTemplate).toHaveBeenCalledWith(fakeDb, "biz-1", {
      mocked: true,
    });
  });

  it("maps ENOENT from readFileSync to a build hint", async () => {
    mocks.getDb.mockReturnValue(dbForBusinessLookup([{ templateSeeded: false }]));
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    mocks.readFileSync.mockImplementationOnce(() => {
      throw err;
    });

    const result = await seedEnterpriseTemplateAction("biz-1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error branch");
    expect(result.error).toContain("templates:build");
  });

  it("maps TemplateSeedError to ok: false with message", async () => {
    mocks.getDb.mockReturnValue(dbForBusinessLookup([{ templateSeeded: false }]));
    mocks.readFileSync.mockReturnValueOnce("{}");
    mocks.verifyAndParseBundle.mockReturnValueOnce({} as never);
    mocks.seedEnterpriseTemplate.mockRejectedValueOnce(
      new TemplateSeedError("BUNDLE_SCHEMA_INVALID", "Bundle invalid"),
    );

    const result = await seedEnterpriseTemplateAction("biz-1");

    expect(result).toEqual({ ok: false, error: "Bundle invalid" });
  });
});
