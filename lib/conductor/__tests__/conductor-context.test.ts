import { describe, expect, it } from "vitest";

import {
  applyConductorInstructionPlaceholders,
  type ConductorOrchestrationSnapshot,
} from "../conductor-context.js";

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
});
