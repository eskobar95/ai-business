import { describe, expect, it } from "vitest";

import type { TaskTreeNode } from "../task-tree";
import { flattenTaskTree } from "../flatten-task-tree";

function row(
  overrides: Partial<{
    id: string;
    parentTaskId: string | null;
    title: string;
    status: "backlog" | "todo" | "in_progress" | "blocked" | "in_review" | "done";
  }> = {},
) {
  const id = overrides.id ?? "t1";
  return {
    id,
    businessId: "b1",
    teamId: null as string | null,
    agentId: null as string | null,
    parentTaskId: overrides.parentTaskId ?? null,
    title: overrides.title ?? "Task",
    description: "",
    status: overrides.status ?? "backlog",
    priority: "medium" as string | null,
    labels: [] as string[],
    project: null as string | null,
    projectId: null as string | null,
    sprintId: null as string | null,
    storyPoints: null as number | null,
    blockedReason: null as string | null,
    approvalId: null as string | null,
    dependencyTaskId: null as string | null,
    githubPrNumber: null as number | null,
    githubRepoInstallationId: null as string | null,
    githubPrStatus: null as string | null,
    prMergedToIntegration: false,
    gatesLockedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [] as TaskTreeNode[],
  };
}

describe("flattenTaskTree", () => {
  it("walks depth-first and omits children arrays from rows", () => {
    const child = row({ id: "child", parentTaskId: "root", title: "Child" });
    const root = row({ id: "root", title: "Root" });
    root.children = [child];

    const flat = flattenTaskTree([root]);
    expect(flat.map((t) => t.id)).toEqual(["root", "child"]);
    expect(flat[0]).not.toHaveProperty("children");
  });
});
