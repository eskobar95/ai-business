import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  update: vi.fn(),
  query: {
    tasks: {
      findFirst: vi.fn(),
    },
    githubInstallations: {
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

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
}));

vi.mock("@/lib/orchestration/events", () => ({
  logEvent: vi.fn(async () => "event-1"),
}));

vi.mock("../promotion-auth", () => ({
  assertMayPromoteToTodo: vi.fn(async () => {}),
}));

vi.mock("../auto-trigger", () => ({
  maybeAutoTriggerTask: vi.fn(async () => ({ triggered: false })),
}));

import { updateTaskDependency, updateTaskPrLink, updateTaskStatus } from "../actions";
import { logEvent } from "@/lib/orchestration/events";
import { maybeAutoTriggerTask } from "../auto-trigger";

const baseTask = {
  id: "task-1",
  businessId: "b1",
  title: "T",
  description: "",
  status: "backlog" as const,
  teamId: null as string | null,
  agentId: null as string | null,
  parentTaskId: null as string | null,
  blockedReason: null as string | null,
  approvalId: null as string | null,
  dependencyTaskId: null as string | null,
  githubPrNumber: null as number | null,
  githubRepoInstallationId: null as string | null,
  githubPrStatus: null as string | null,
  prMergedToIntegration: false,
  gatesLockedAt: null as Date | null,
  priority: "medium" as string | null,
  labels: [] as string[],
  mission: null as string | null,
  missionId: null as string | null,
  sprintId: null as string | null,
  storyPoints: null as number | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("updateTaskDependency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.update.mockReturnValue({
      set: () => ({
        where: vi.fn(async () => {}),
      }),
    });
  });

  it("accepts null (clear dependency)", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);

    await expect(updateTaskDependency("task-1", null)).resolves.toBeUndefined();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("rejects self-dependency (taskId === dependencyTaskId)", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);

    await expect(updateTaskDependency("task-1", "task-1")).rejects.toThrow("cannot depend on itself");
  });

  it("rejects dependency from different business", async () => {
    mockDb.query.tasks.findFirst
      .mockResolvedValueOnce(baseTask)
      .mockResolvedValueOnce({ businessId: "other" });

    await expect(updateTaskDependency("task-1", "dep-1")).rejects.toThrow(
      "must belong to the same business",
    );
  });

  it("rejects circular dependency chain", async () => {
    mockDb.query.tasks.findFirst
      .mockResolvedValueOnce(baseTask)
      .mockResolvedValueOnce({ businessId: "b1" })
      .mockResolvedValueOnce({ dependencyTaskId: "task-1" });

    await expect(updateTaskDependency("task-1", "dep-b")).rejects.toThrow(
      "Circular task dependencies are not allowed",
    );
  });

  it("rejects dependency chains deeper than the maximum walk length", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({ businessId: "b1" });
    for (let i = 0; i < 64; i++) {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        dependencyTaskId: `dep-${i + 1}`,
      });
    }

    await expect(updateTaskDependency("task-1", "dep-0")).rejects.toThrow(
      "Task dependency chain exceeds maximum depth",
    );
  });
});

describe("updateTaskStatus backlog to todo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.update.mockReturnValue({
      set: () => ({
        where: vi.fn(async () => {}),
      }),
    });
  });

  it("delegates to promotion path and logs orchestration event", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue({
      ...baseTask,
      approvalId: "approval-x",
    });

    await updateTaskStatus("task-1", "todo");

    expect(mockDb.query.tasks.findFirst).toHaveBeenCalledTimes(1);

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task.promoted_to_todo",
        businessId: "b1",
        payload: { taskId: "task-1" },
        status: "succeeded",
      }),
    );
    expect(mockDb.update).toHaveBeenCalled();
    expect(maybeAutoTriggerTask).toHaveBeenCalledWith("task-1");
  });
});

describe("updateTaskPrLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.update.mockReturnValue({
      set: () => ({
        where: vi.fn(async () => {}),
      }),
    });
  });

  it("accepts valid prNumber + installationId", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);
    mockDb.query.githubInstallations.findFirst.mockResolvedValue({ id: "inst-1" });

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: 42,
        githubRepoInstallationId: "inst-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects negative PR numbers", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: -1,
        githubRepoInstallationId: "inst-1",
      }),
    ).rejects.toThrow("positive integer");
  });

  it("rejects when only one of prNumber/installationId is set", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: 1,
        githubRepoInstallationId: null,
      }),
    ).rejects.toThrow("both be set");

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: null,
        githubRepoInstallationId: "inst-1",
      }),
    ).rejects.toThrow("both be set");
  });

  it("rejects installationId from different business", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);
    mockDb.query.githubInstallations.findFirst.mockResolvedValue(undefined);

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: 1,
        githubRepoInstallationId: "inst-bad",
      }),
    ).rejects.toThrow("GitHub installation not found");
  });

  it("accepts null/null (clear link)", async () => {
    mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);

    await expect(
      updateTaskPrLink("task-1", {
        githubPrNumber: null,
        githubRepoInstallationId: null,
      }),
    ).resolves.toBeUndefined();
    expect(mockDb.query.githubInstallations.findFirst).not.toHaveBeenCalled();
  });
});
