import { describe, expect, it } from "vitest";

import {
  AGENT_GIT_EMAIL_DOMAIN,
  getAgentGitConfig,
} from "@/lib/github/agent-git-config";

const TEN_SLUGS = [
  "product_owner",
  "market_intelligence_analyst",
  "ux_designer",
  "requirements_analyst",
  "engineering_manager",
  "tech_lead",
  "software_engineer",
  "qa_engineer",
  "security_reviewer",
  "devops_engineer",
] as const;

describe("getAgentGitConfig", () => {
  it("formats name, email and env vars for roster agents", () => {
    const cfg = getAgentGitConfig({
      name: "Alex",
      role: "Software Engineer",
      slug: "software_engineer",
    });

    expect(cfg.name).toBe("Alex (Software Engineer)");
    expect(cfg.email).toBe(`software_engineer@${AGENT_GIT_EMAIL_DOMAIN}`);
    expect(cfg.envVars.GIT_AUTHOR_NAME).toBe(cfg.name);
    expect(cfg.envVars.GIT_AUTHOR_EMAIL).toBe(cfg.email);
    expect(cfg.envVars.GIT_COMMITTER_NAME).toBe(cfg.name);
    expect(cfg.envVars.GIT_COMMITTER_EMAIL).toBe(cfg.email);
  });

  it("covers enterprise template slug set", () => {
    for (const slug of TEN_SLUGS) {
      const row = getAgentGitConfig({
        name: String(slug),
        role: "Role Label",
        slug,
      });
      expect(row.email).toBe(`${slug}@${AGENT_GIT_EMAIL_DOMAIN}`);
      expect(row.name).toContain(String(slug));
    }
  });

  it("rejects blank slug", () => {
    expect(() =>
      getAgentGitConfig({
        name: "A",
        role: "R",
        slug: "   ",
      }),
    ).toThrow(/slug/);
  });
});
