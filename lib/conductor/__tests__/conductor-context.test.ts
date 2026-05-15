import { describe, expect, it } from "vitest";

import {
  applyConductorInstructionPlaceholders,
  type ConductorOrchestrationSnapshot,
} from "../conductor-context.js";
import { CONDUCTOR_INSTRUCTION_TEMPLATE } from "../conductor-instruction-template.js";

function snap(over: Partial<ConductorOrchestrationSnapshot> = {}): ConductorOrchestrationSnapshot {
  return {
    businessName: "Acme",
    soulMarkdown: "SOUL",
    agentRosterText: "ROSTER",
    activeMissionsText: "MISSIONS",
    pendingApprovalsCount: 2,
    pendingApprovalTitlesText: "- One\n- Two",
    ...over,
  };
}

describe("applyConductorInstructionPlaceholders", () => {
  it("replaces all known tokens", () => {
    const tpl =
      "Hi [BUSINESS_NAME]\n[SOUL_MARKDOWN]\n[AGENT_ROSTER]\n[ACTIVE_MISSIONS]\n[APPROVALS_COUNT]\n[APPROVAL_TITLES]";
    const out = applyConductorInstructionPlaceholders(tpl, snap());
    expect(out).toContain("Hi Acme");
    expect(out).toContain("SOUL");
    expect(out).toContain("ROSTER");
    expect(out).toContain("MISSIONS");
    expect(out).toContain("2");
    expect(out).toContain("- One");
  });

  it("hydrates the bundled default template without leftover bracket tokens", () => {
    const out = applyConductorInstructionPlaceholders(CONDUCTOR_INSTRUCTION_TEMPLATE.trim(), snap());
    expect(out).toContain("Acme");
    expect(out).not.toMatch(/\[BUSINESS_NAME]/);
    expect(out).not.toMatch(/\[SOUL_MARKDOWN]/);
    expect(out).not.toMatch(/\[AGENT_ROSTER]/);
  });
});
