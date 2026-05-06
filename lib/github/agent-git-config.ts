/**
 * Canonical git author identity for spawned agent jobs (ADR / Stream C runner contract).
 */

export type AgentGitConfigInput = {
  name: string;
  role: string;
  slug: string;
};

export type AgentGitConfig = {
  name: string;
  email: string;
  envVars: Record<string, string>;
};

/** Default email domain for synthetic agent identities. */
export const AGENT_GIT_EMAIL_DOMAIN = "agents.conduro.ai";

/**
 * Builds `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env pairs for Cursor CLI subprocesses.
 */
export function getAgentGitConfig(agent: AgentGitConfigInput): AgentGitConfig {
  const trimmedSlug = agent.slug.trim();
  if (!trimmedSlug) {
    throw new Error("Agent slug is required for git attribution");
  }
  const displayName = `${agent.name.trim()} (${agent.role.trim()})`.trim();
  const email = `${trimmedSlug}@${AGENT_GIT_EMAIL_DOMAIN}`;
  const envVars: Record<string, string> = {
    GIT_AUTHOR_NAME: displayName,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: displayName,
    GIT_COMMITTER_EMAIL: email,
  };
  return {
    name: displayName,
    email,
    envVars,
  };
}
