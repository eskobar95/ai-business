import { beforeEach, describe, expect, it, vi } from "vitest";

import { GRILL_ME_COMPLETE_MARKER } from "@/lib/grill-me/markers";
import {
  minimalFallbackReasoningContext,
  type GrillReasoningContext,
} from "@/lib/grill-me/grill-reasoning-types";

const businessId = "00000000-0000-4000-8000-000000000042";

const completeSoulMock = [
  GRILL_ME_COMPLETE_MARKER,
  "",
  "Here is your Soul Document — you can edit it directly in the next step.",
  "",
  "```markdown",
  "# Soul Document Framework",
  "Hello world",
  "```",
  "",
].join("\n");

const store = vi.hoisted(() => ({
  grillRows: [] as Array<{
    businessId: string;
    role: string;
    content: string;
    seq: number;
  }>,
  memoryInserts: [] as Array<Record<string, unknown>>,
  selectPass: 0,
  lastCursorPrompt: "",
  persistedReasoning: null as GrillReasoningContext | null,
}));

function defaultPersistedReasoning(): GrillReasoningContext {
  const r = minimalFallbackReasoningContext(
    "existing",
    "Wizard Test Biz",
    "We ship widgets",
  );
  return {
    ...r,
    knownFields: {
      ...r.knownFields,
      githubRepo: "https://github.com/acme/public",
    },
  };
}

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: vi.fn(async () => ({
      data: { user: { id: "test-user-id" } },
    })),
  },
}));

vi.mock("@/lib/settings/cursor-api-key", () => ({
  getUserCursorApiKeyDecrypted: vi.fn(async () => null),
}));

vi.mock("@/lib/cursor/agent", () => ({
  runCursorAgent: vi.fn(async (prompt: string) => {
    store.lastCursorPrompt = prompt;
    async function* gen() {
      yield completeSoulMock;
    }
    return gen();
  }),
}));

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        businesses: {
          findFirst: vi.fn(async () => ({
            id: businessId,
            name: "Wizard Test Biz",
            description: "We ship widgets",
            githubRepoUrl: "https://github.com/acme/public",
            grillReasoningContext:
              store.persistedReasoning ?? defaultPersistedReasoning(),
          })),
        },
        userBusinesses: {
          findFirst: vi.fn(async () => ({
            userId: "test-user-id",
            businessId,
          })),
        },
        memory: {
          findFirst: vi.fn(async () => undefined),
        },
      },
      insert() {
        return {
          values: (vals: Record<string, unknown>) => {
            if ("seq" in vals && "role" in vals) {
              store.grillRows.push({
                businessId: vals.businessId as string,
                role: vals.role as string,
                content: vals.content as string,
                seq: vals.seq as number,
              });
            }
            if (vals.scope === "business") {
              store.memoryInserts.push(vals);
            }
            return Promise.resolve(undefined);
          },
        };
      },
      select(fields?: Record<string, unknown>) {
        void fields;
        store.selectPass++;
        if (store.selectPass === 1) {
          return {
            from: () => ({
              where: () => Promise.resolve([{ nextSeq: 0 }]),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              orderBy: () =>
                Promise.resolve(
                  [...store.grillRows]
                    .filter((r) => r.businessId === businessId)
                    .sort((a, b) => b.seq - a.seq)
                    .map((r) => ({
                      businessId: r.businessId,
                      role: r.role,
                      content: r.content,
                      seq: r.seq,
                    })),
                ),
            }),
          }),
        };
      },
    };
  },
}));

describe("startGrillMeTurn", () => {
  beforeEach(() => {
    store.grillRows = [];
    store.memoryInserts = [];
    store.selectPass = 0;
    store.lastCursorPrompt = "";
    store.persistedReasoning = defaultPersistedReasoning();
    delete process.env.CURSOR_GRILL_ME_SETTING_SOURCES;
    delete process.env.CURSOR_GRILL_ME_MODEL_ID;
    delete process.env.CURSOR_GRILL_ME_MODEL_PARAMS_JSON;
    vi.clearAllMocks();
  });

  it("persists user turn with role user and stores soul memory when marker present", async () => {
    const { startGrillMeTurn } = await import("../actions.js");
    const { runCursorAgent } = await import("@/lib/cursor/agent");

    const userMessage = "Describe my product";
    const result = await startGrillMeTurn(businessId, userMessage);

    expect(runCursorAgent).toHaveBeenCalled();

    const userRow = store.grillRows.find((r) => r.role === "user");
    expect(userRow).toBeDefined();
    expect(userRow?.businessId).toBe(businessId);
    expect(userRow?.content).toBe(userMessage);

    const assistantRow = store.grillRows.find((r) => r.role === "assistant");
    expect(assistantRow).toBeDefined();
    expect(result.soulStored).toBe(true);
    expect(result.assistantReply).toContain(GRILL_ME_COMPLETE_MARKER);

    expect(store.memoryInserts.length).toBe(1);
    const mem = store.memoryInserts[0];
    expect(mem.scope).toBe("business");
    expect(mem.businessId).toBe(businessId);
    expect(mem.agentId ?? null).toBeNull();
    expect(typeof mem.content).toBe("string");
    expect((mem.content as string).includes("# Soul")).toBe(true);
    expect((mem.content as string).includes(GRILL_ME_COMPLETE_MARKER)).toBe(false);
  }, 30_000);

  it("default Grill-Me path uses Prompt 2 chat system instructions", async () => {
    const { startGrillMeTurn } = await import("../actions.js");
    await startGrillMeTurn(businessId, "Hi");
    expect(store.lastCursorPrompt).toContain(
      "# Grill-Me — chat system (Prompt 2)",
    );
    expect(store.lastCursorPrompt).toContain(
      "sharp, friendly interviewer",
    );
    expect(store.lastCursorPrompt).toContain("## Your context");
  });

  it("injects persisted reasoning JSON (wizard seed) into Prompt 2", async () => {
    const { startGrillMeTurn } = await import("../actions.js");
    await startGrillMeTurn(businessId, "Hi");
    expect(store.lastCursorPrompt).toContain('"businessType": "existing"');
    expect(store.lastCursorPrompt).toContain("Wizard Test Biz");
    expect(store.lastCursorPrompt).toContain(
      "https://github.com/acme/public",
    );
    expect(store.lastCursorPrompt).toContain("We ship widgets");
  });

  it("passes stored businessType new when reasoning snapshot is new", async () => {
    const { startGrillMeTurn } = await import("../actions.js");
    store.persistedReasoning = minimalFallbackReasoningContext(
      "new",
      "Wizard Test Biz",
      "We ship widgets",
    );
    await startGrillMeTurn(businessId, "Hi", "new");
    expect(store.lastCursorPrompt).toContain('"businessType": "new"');
    expect(store.lastCursorPrompt).not.toContain('"businessType": "existing"');
  });
  it("injects onboarding skill appendix from repo default path", async () => {
    const { startGrillMeTurn } = await import("../actions.js");
    const { runCursorAgent } = await import("@/lib/cursor/agent");
    await startGrillMeTurn(businessId, "Hi");
    expect(store.lastCursorPrompt).toContain(
      "# Optional interviewer style notes",
    );
    expect(store.lastCursorPrompt).toContain("Grill-Me onboarding interviewer");
    expect(runCursorAgent).toHaveBeenCalledWith(
      expect.stringContaining("# Optional interviewer style notes"),
      expect.objectContaining({
        localSettingSources: ["project"],
      }),
    );
  });
});
