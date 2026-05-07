import { beforeEach, describe, expect, it, vi } from "vitest";

const finishOrchestrationEvent = vi.hoisted(() => vi.fn());
const getBusinessLocalPath = vi.hoisted(() => vi.fn());

vi.mock("../queries", () => ({
  finishOrchestrationEvent,
  getBusinessLocalPath,
}));

const assertBusinessReadyForExecution = vi.hoisted(() => vi.fn());
vi.mock("../readiness-check", () => ({
  assertBusinessReadyForExecution,
}));

const buildLeadHeartbeatPrompt = vi.hoisted(() => vi.fn());
vi.mock("../lead-heartbeat-prompt", () => ({
  buildLeadHeartbeatPrompt,
}));

const resolveCursorConfig = vi.hoisted(() => vi.fn());
vi.mock("../cursor-config-resolver", () => ({
  resolveCursorConfig,
}));

const promoteTaskToTodoByRunner = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tasks/runner-promote", () => ({
  promoteTaskToTodoByRunner,
}));

const evaluateTaskGates = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tasks/gate-evaluator", () => ({
  evaluateTaskGates,
}));

const getDb = vi.hoisted(() => vi.fn());
vi.mock("@/db/index", () => ({
  getDb,
}));

const AgentCreate = vi.hoisted(() => vi.fn());
vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: (...args: unknown[]) => AgentCreate(...args),
  },
}));

import { dispatchLeadHeartbeat, parseLeadOutput } from "../lead-heartbeat";

const task1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const task2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeDbMock(
  leadRow: { id: string; name: string; heartbeatPromotionCap: number } | null,
  backlog: Array<{
    id: string;
    title: string;
    description: string | null;
    dependencyTaskId: string | null;
    githubPrNumber: number | null;
    prMergedToIntegration: boolean;
    agentId: string | null;
  }>,
) {
  const limitResult = leadRow ? [leadRow] : [];
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(limitResult)),
          })),
        })),
      })),
    })),
    query: {
      tasks: {
        findMany: vi.fn(() => Promise.resolve(backlog)),
      },
    },
  };
}

function makeAgentSdk(text: string) {
  const sdk = {
    send: vi.fn(async () => ({
      async *stream() {
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text }] },
        };
      },
      wait: async () => ({}),
    })),
    close: vi.fn(),
  };
  return sdk;
}

describe("parseLeadOutput", () => {
  it("extracts promote list from json block", () => {
    const ids = parseLeadOutput('prefix\n```json\n{ "promote": ["a", "b"] }\n```\n');
    expect(ids).toEqual(["a", "b"]);
  });

  it("handles raw JSON without code fence", () => {
    const ids = parseLeadOutput('{ "promote": [ "x", "y" ] }');
    expect(ids).toEqual(["x", "y"]);
  });

  it("returns empty array for unparseable output", () => {
    expect(parseLeadOutput("no json here")).toEqual([]);
  });

  it("filters non-string entries", () => {
    const ids = parseLeadOutput('```json\n{ "promote": ["ok", 1, null, "z"] }\n```');
    expect(ids).toEqual(["ok", "z"]);
  });
});

describe("dispatchLeadHeartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBusinessLocalPath.mockResolvedValue("/repo");
    assertBusinessReadyForExecution.mockResolvedValue(undefined);
    buildLeadHeartbeatPrompt.mockResolvedValue("prompt");
    resolveCursorConfig.mockResolvedValue({ modelId: undefined, thinkingEffort: undefined });
    promoteTaskToTodoByRunner.mockResolvedValue(undefined);
    evaluateTaskGates.mockResolvedValue({ ready: true, dependencyOk: true, prOk: true, reasons: [] });
  });

  it("fails if no businessId", async () => {
    await dispatchLeadHeartbeat(
      "evt-1",
      { businessId: null, payload: { x: 1 } },
      "",
    );
    expect(finishOrchestrationEvent).toHaveBeenCalledWith("evt-1", {
      status: "failed",
      payload: expect.objectContaining({
        runnerError: "lead_heartbeat requires businessId",
      }),
    });
  });

  it("fails if readiness gate not met", async () => {
    assertBusinessReadyForExecution.mockRejectedValueOnce(new Error("no memory"));
    await dispatchLeadHeartbeat("evt-1", { businessId: "biz-1", payload: {} }, "");
    expect(finishOrchestrationEvent).toHaveBeenCalledWith("evt-1", {
      status: "failed",
      payload: expect.objectContaining({ runnerError: "no memory" }),
    });
  });

  it("fails if no lead agent with runsHeartbeat=true", async () => {
    getDb.mockReturnValue(makeDbMock(null, []));
    await dispatchLeadHeartbeat("evt-1", { businessId: "biz-1", payload: {} }, "");
    expect(finishOrchestrationEvent).toHaveBeenCalledWith("evt-1", {
      status: "failed",
      payload: expect.objectContaining({
        runnerError: "No agent with runsHeartbeat=true found for business.",
      }),
    });
  });

  it("promotes up to heartbeatPromotionCap tasks", async () => {
    getDb.mockReturnValue(
      makeDbMock(
        { id: "lead-1", name: "Lead", heartbeatPromotionCap: 1 },
        [
          {
            id: task1,
            title: "T1",
            description: null,
            dependencyTaskId: null,
            githubPrNumber: null,
            prMergedToIntegration: false,
            agentId: null,
          },
          {
            id: task2,
            title: "T2",
            description: null,
            dependencyTaskId: null,
            githubPrNumber: null,
            prMergedToIntegration: false,
            agentId: null,
          },
        ],
      ),
    );
    const sdk = makeAgentSdk(
      `\`\`\`json\n${JSON.stringify({ promote: [task1, task2] })}\n\`\`\``,
    );
    AgentCreate.mockResolvedValue(sdk);

    await dispatchLeadHeartbeat("evt-1", { businessId: "biz-1", payload: {} }, "");

    expect(promoteTaskToTodoByRunner).toHaveBeenCalledTimes(1);
    expect(promoteTaskToTodoByRunner).toHaveBeenCalledWith(task1, "lead-1");

    expect(finishOrchestrationEvent).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({
        status: "succeeded",
        payload: expect.objectContaining({
          promotionsRequested: 2,
          promotionsCapped: 1,
          promoted: [task1],
        }),
      }),
    );
  });

  it("does not promote BLOCKED tasks", async () => {
    getDb.mockReturnValue(
      makeDbMock(
        { id: "lead-1", name: "Lead", heartbeatPromotionCap: 5 },
        [
          {
            id: task1,
            title: "T1",
            description: null,
            dependencyTaskId: null,
            githubPrNumber: null,
            prMergedToIntegration: false,
            agentId: null,
          },
        ],
      ),
    );
    evaluateTaskGates.mockResolvedValue({
      ready: false,
      dependencyOk: false,
      prOk: true,
      reasons: ["dependency not done"],
    });
    const sdk = makeAgentSdk(
      `\`\`\`json\n${JSON.stringify({ promote: [task1] })}\n\`\`\``,
    );
    AgentCreate.mockResolvedValue(sdk);

    await dispatchLeadHeartbeat("evt-1", { businessId: "biz-1", payload: {} }, "");

    expect(promoteTaskToTodoByRunner).not.toHaveBeenCalled();
    expect(finishOrchestrationEvent).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({
        status: "succeeded",
        payload: expect.objectContaining({
          promoted: [],
          errors: expect.arrayContaining([expect.stringContaining("dependency not done")]),
        }),
      }),
    );
  });

  it("logs all promotions and errors in event payload", async () => {
    getDb.mockReturnValue(
      makeDbMock(
        { id: "lead-1", name: "Lead", heartbeatPromotionCap: 5 },
        [
          {
            id: task1,
            title: "T1",
            description: null,
            dependencyTaskId: null,
            githubPrNumber: null,
            prMergedToIntegration: false,
            agentId: null,
          },
        ],
      ),
    );
    promoteTaskToTodoByRunner.mockRejectedValueOnce(new Error("promo failed"));
    const sdk = makeAgentSdk(
      `\`\`\`json\n${JSON.stringify({ promote: [task1] })}\n\`\`\``,
    );
    AgentCreate.mockResolvedValue(sdk);

    await dispatchLeadHeartbeat("evt-1", { businessId: "biz-1", payload: {} }, "");

    expect(finishOrchestrationEvent).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({
        status: "succeeded",
        payload: expect.objectContaining({
          candidatesFound: 1,
          promotionsRequested: 1,
          promoted: [],
          errors: expect.arrayContaining([expect.stringContaining("promo failed")]),
        }),
      }),
    );
  });
});
