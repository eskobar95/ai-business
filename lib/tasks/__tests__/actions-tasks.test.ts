import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: {
    tasks: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    approvals: {
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

vi.mock("@/lib/orchestration/events", () => ({
  logEvent: vi.fn(async () => "event-1"),
}));

import { createTask, getTasksByBusiness, getTasksByAgent, updateTaskStatus } from "../actions";
import { logEvent } from "@/lib/orchestration/events";

describe("tasks actions (mocked db)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createTask inserts backlog task with defaults", async () => {
    mockDb.insert.mockReturnValue({
      values: (vals: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          expect(vals.status).toBe("backlog");
          expect(vals.title).toBe("Hello");
          expect(vals.description).toBe("");
          return [{ id: "t-new" }];
        }),
      }),
    });

    const { id } = await createTask("b1", { title: "Hello" });
    expect(id).toBe("t-new");
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("createTask logs promoted_to_todo when status is todo", async () => {
    mockDb.insert.mockReturnValue({
      values: (vals: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          expect(vals.status).toBe("todo");
          return [{ id: "t-todo" }];
        }),
      }),
    });

    const { id } = await createTask("b1", { title: "Hello", status: "todo" });
    expect(id).toBe("t-todo");
    expect(logEvent).toHaveBeenCalledWith({
      type: "task.promoted_to_todo",
      businessId: "b1",
      payload: { taskId: "t-todo", source: "create_task" },
      status: "succeeded",
    });
  });

  it("updateTaskStatus links approval when in_review", async () => {
    const taskRow = {
      id: "task-1",
      businessId: "b1",
      title: "T",
      description: "",
      status: "in_progress" as const,
      teamId: null as string | null,
      agentId: null as string | null,
      parentTaskId: null as string | null,
      blockedReason: null as string | null,
      approvalId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.query.tasks.findFirst.mockResolvedValue(taskRow);
    mockDb.query.approvals.findFirst.mockResolvedValue({ id: "ap1", businessId: "b1" });

    mockDb.update.mockReturnValue({
      set: (patch: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          Object.assign(taskRow, patch);
        }),
      }),
    });

    await updateTaskStatus("task-1", "in_review", { approvalId: "ap1" });

    expect(taskRow.status).toBe("in_review");
    expect(taskRow.approvalId).toBe("ap1");
  });

  it("getTasksByBusiness returns nested children", async () => {
    const parent = {
      id: "p",
      businessId: "b1",
      title: "Parent",
      description: "",
      status: "backlog" as const,
      teamId: null,
      agentId: null,
      parentTaskId: null,
      blockedReason: null,
      approvalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const child = {
      ...parent,
      id: "c",
      title: "Child",
      parentTaskId: "p",
    };

    mockDb.query.tasks.findMany.mockResolvedValue([parent, child]);

    const tree = await getTasksByBusiness("b1");
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("p");
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.id).toBe("c");
  });

  it("getTasksByAgent returns tasks for agent", async () => {
    const row = {
      id: "t1",
      businessId: "b1",
      title: "A",
      description: "",
      status: "backlog" as const,
      teamId: null,
      agentId: "ag1",
      parentTaskId: null,
      blockedReason: null,
      approvalId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockDb.query.tasks.findMany.mockResolvedValue([row]);

    const list = await getTasksByAgent("ag1");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("t1");
  });
});
