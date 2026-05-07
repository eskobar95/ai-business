import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() =>
  vi.fn(async () => ({
    stream() {
      return (async function* () {
        /* no usage messages in CI stub */
      })();
    },
    async wait() {
        return {
          id: "run-1",
          status: "finished" as const,
          durationMs: 42,
          model: { id: "composer-2", params: [] as { id: string; value: string }[] },
        };
    },
  }))
);

const mockAgentClose = vi.hoisted(() => vi.fn());
type HeartbeatEventRow = { payload: Record<string, unknown>; status: string; type?: string };
const insertedRows = vi.hoisted(() => [] as HeartbeatEventRow[]);

const agentsFindFirst = vi.hoisted(() =>
  vi.fn(async () => ({ systemRoleId: null as string | null })),
);
const systemRolesFindFirst = vi.hoisted(() =>
  vi.fn(async () => ({ runsHeartbeat: false })),
);

vi.mock("@/lib/agents/actions", () => ({
  assertUserOwnsAgent: vi.fn(async () => ({ userId: "user-1", businessId: "biz-1" })),
}));

vi.mock("@/lib/settings/cursor-api-key", () => ({
  getUserCursorApiKeyDecrypted: vi.fn(async () => "cursor-api-key-stub"),
}));

vi.mock("@/lib/heartbeat/prompt-builder", () => ({
  buildHeartbeatPrompt: vi.fn(async () => "## Prompt body"),
}));

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async () => ({
      send: mockSend,
      close: mockAgentClose,
    })),
  },
}));

vi.mock("@/db/index", () => ({
  getDb() {
    return {
      query: {
        businesses: {
          findFirst: vi.fn(async () => ({ localPath: "/tmp/workspace" })),
        },
        agents: {
          findFirst: agentsFindFirst,
        },
        systemRoles: {
          findFirst: systemRolesFindFirst,
        },
      },
      insert() {
        return {
          values: (vals: Record<string, unknown>) => ({
            returning: vi.fn(async () => {
              insertedRows.push({
                payload: vals.payload as Record<string, unknown>,
                status: vals.status as string,
                type: vals.type as string | undefined,
              });
              return [{ id: `evt-${insertedRows.length}` }];
            }),
          }),
        };
      },
    };
  },
}));

import { runHeartbeat } from "@/lib/heartbeat/actions.js";

describe("runHeartbeat", () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockAgentClose.mockClear();
    insertedRows.length = 0;
    agentsFindFirst.mockResolvedValue({ systemRoleId: null });
    systemRolesFindFirst.mockResolvedValue({ runsHeartbeat: false });
  });

  it("logs heartbeat_run orchestration_events row with token placeholders and succeeds", async () => {
    const res = await runHeartbeat("agent-1");
    expect(res).toEqual({ success: true, eventId: "evt-1" });
    expect(mockSend).toHaveBeenCalled();
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.status).toBe("succeeded");
    expect(insertedRows[0]?.type).toBe("heartbeat_run");
    expect(insertedRows[0]?.payload.agentId).toBe("agent-1");
    expect(insertedRows[0]?.payload.trigger).toBe("manual");
    expect(insertedRows[0]?.payload.model).toBe("composer-2");
    expect(insertedRows[0]?.payload.durationMs).toBeDefined();
    expect(insertedRows[0]?.payload).toHaveProperty("tokensIn");
    expect(insertedRows[0]?.payload).toHaveProperty("tokensOut");
  });

  it("enqueues lead_heartbeat for agents with runsHeartbeat role (no SDK in-request)", async () => {
    agentsFindFirst.mockResolvedValue({ systemRoleId: "role-lead" });
    systemRolesFindFirst.mockResolvedValue({ runsHeartbeat: true });

    const res = await runHeartbeat("agent-lead");

    expect(res).toEqual({ success: true, eventId: "evt-1" });
    expect(mockSend).not.toHaveBeenCalled();
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.type).toBe("lead_heartbeat");
    expect(insertedRows[0]?.status).toBe("pending");
    expect(insertedRows[0]?.payload).toMatchObject({
      agentId: "agent-lead",
      trigger: "manual_ui",
    });
  });
});
