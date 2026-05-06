import { describe, expect, it } from "vitest";

import { taskStatusEnum } from "@/db/schema";

describe("S1 schema additions", () => {
  it("taskStatusEnum includes todo", () => {
    expect(taskStatusEnum.enumValues).toContain("todo");
  });

  it("todo is between backlog and in_progress", () => {
    const values = taskStatusEnum.enumValues;
    const backlogIdx = values.indexOf("backlog");
    const todoIdx = values.indexOf("todo");
    const inProgressIdx = values.indexOf("in_progress");
    expect(todoIdx).toBeGreaterThan(backlogIdx);
    expect(todoIdx).toBeLessThan(inProgressIdx);
  });
});
