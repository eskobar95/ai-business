/** Build the full prompt sent to Cursor for orchestrated runs (runner). */

export type OrchestrationPromptContext = {
  /** When set (typically `mention_trigger`), quoted as blockquote for the SDK prompt. */
  mentionExcerpt?: string;
  systemRoleBasePrompt: string;
  includeBusinessMemory: boolean;
  businessMemoryMarkdown: string | null;
  agentInstructions: string;
  /** Serialized skills (path + excerpt). */
  skillsBlock: string;
  /** webhook_trigger envelope */
  orchestrationPayload: Record<string, unknown>;
};

const SEP = "\n\n---\n\n";

export function buildOrchestrationPrompt(c: OrchestrationPromptContext): string {
  const parts: string[] = [];
  if (c.mentionExcerpt?.trim()) {
    const q = c.mentionExcerpt.trim();
    parts.push(
      `## Mention context\n\nA user mentioned you in a task comment:\n\n> ${q}`,
    );
  }
  parts.push(`# System role (platform)\n\n${c.systemRoleBasePrompt.trim()}`);
  parts.push(`# Agent instructions (user-defined; constraints take precedence)\n\n${c.agentInstructions.trim() || "(none)"}`);
  if (c.includeBusinessMemory) {
    parts.push(
      `# Business memory (organisation context)\n\n${c.businessMemoryMarkdown?.trim() || "(missing — complete Grill-Me onboarding)"}`,
    );
  }
  if (c.skillsBlock.trim()) {
    parts.push(`# Attached skills\n\n${c.skillsBlock.trim()}`);
  }
  parts.push(
    `# Trigger payload (JSON)\n\n\`\`\`json\n${JSON.stringify(c.orchestrationPayload, null, 2)}\n\`\`\`\n\nRespond with a clear, actionable summary for humans. If you changed code, list files touched.`,
  );
  return parts.join(SEP);
}
