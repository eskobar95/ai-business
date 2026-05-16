import { describe, expect, it } from "vitest";

import { parseEmTasksFromOutput } from "@/lib/missions/em-parse";

describe("parseEmTasksFromOutput", () => {
  it("parses first json fence into tasks", () => {
    const md = `
Some prose.

\`\`\`json
[
  { "title": "A", "description": "Do A", "agentSlug": "software_engineer", "priority": "high" },
  { "title": "B", "agentSlug": "qa_engineer", "estimatedHours": 2 }
]
\`\`\`
`;
    const tasks = parseEmTasksFromOutput(md);
    expect(tasks).toHaveLength(2);
    expect(tasks![0]).toMatchObject({
      title: "A",
      description: "Do A",
      agentSlug: "software_engineer",
      priority: "high",
      estimatedHours: 4,
    });
    expect(tasks![1]).toMatchObject({
      title: "B",
      agentSlug: "qa_engineer",
      priority: "medium",
      estimatedHours: 2,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseEmTasksFromOutput("```json\nnot-json\n```")).toBeNull();
  });

  it("returns null when no tasks survive validation", () => {
    expect(
      parseEmTasksFromOutput(
        "```json\n[{\"title\":\"\",\"agentSlug\":\"x\"}]\n```",
      ),
    ).toBeNull();
  });
});
