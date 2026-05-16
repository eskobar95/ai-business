export type ParsedEmTask = {
  title: string;
  description: string;
  agentSlug: string;
  priority: "high" | "medium" | "low";
  estimatedHours: number;
};

const PRIORITIES = new Set(["high", "medium", "low"]);

function normalizePriority(value: unknown): "high" | "medium" | "low" {
  if (typeof value !== "string") return "medium";
  const v = value.trim().toLowerCase();
  return PRIORITIES.has(v) ? (v as "high" | "medium" | "low") : "medium";
}

function normalizeEstimatedHours(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(Math.round(value), 80);
  }
  return 4;
}

/**
 * Expects a single ```json ... ``` fenced block with an array of task objects.
 */
export function parseEmTasksFromOutput(output: string): ParsedEmTask[] | null {
  const fence = output.match(/```json\s*([\s\S]*?)```/i);
  if (!fence?.[1]) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fence[1].trim()) as unknown;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const tasks: ParsedEmTask[] = [];

  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    if (!title) continue;

    const description =
      typeof rec.description === "string" ? rec.description.trim() : "";
    const agentSlugRaw = typeof rec.agentSlug === "string" ? rec.agentSlug.trim() : "";
    const agentSlug =
      agentSlugRaw ||
      (typeof rec.agent_slug === "string" ? rec.agent_slug.trim() : "");

    if (!agentSlug) continue;

    tasks.push({
      title,
      description,
      agentSlug,
      priority: normalizePriority(rec.priority),
      estimatedHours: normalizeEstimatedHours(rec.estimatedHours ?? rec.estimated_hours),
    });
  }

  return tasks.length > 0 ? tasks : null;
}
