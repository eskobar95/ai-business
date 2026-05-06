import { describe, expect, it, vi } from "vitest";

import type { getDb as getDbType } from "@/db/index";

const insertValuesSpy = vi.fn((_vals: Record<string, unknown>) => Promise.resolve());

vi.mock("@/db/index", () => ({
  getDb(): ReturnType<typeof getDbType> {
    return {
      insert: () => ({
        values: insertValuesSpy,
      }),
      query: {
        memory: {
          findFirst: vi.fn(async (): Promise<object | undefined> => undefined),
        },
      },
    } as unknown as ReturnType<typeof getDbType>;
  },
}));

describe("extractAndStoreSoulFile", () => {
  it("inserts business-scope markdown when absent", async () => {
    insertValuesSpy.mockClear();

    const { extractAndStoreSoulFile } =
      await import("../soul-memory.js");

    await extractAndStoreSoulFile(
      "00000000-0000-0000-0000-000000000099",
      "[[GRILL_ME_COMPLETE]]\n\n# Soul\nDone",
    );

    expect(insertValuesSpy).toHaveBeenCalled();
    const tuple = insertValuesSpy.mock.calls[0] as unknown as [unknown] | undefined;
    expect(tuple).toBeDefined();
    const firstArg = tuple![0] as Record<string, unknown>;
    expect(firstArg.scope).toBe("business");
    expect(firstArg.agentId).toBeNull();
    expect(firstArg.businessId).toBe("00000000-0000-0000-0000-000000000099");
    expect(typeof firstArg.content).toBe("string");
  }, 15_000);
});
