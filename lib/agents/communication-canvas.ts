/** Slugs for the default enterprise template streams (Product vs Build). */

export const PRODUCT_STREAM_SLUGS = [
  "product_owner",
  "market_intelligence_analyst",
  "ux_designer",
  "requirements_analyst",
] as const;

export const BUILD_STREAM_SLUGS = [
  "engineering_manager",
  "tech_lead",
  "software_engineer",
  "qa_engineer",
  "security_reviewer",
  "devops_engineer",
] as const;

export type CommunicationStream = "product" | "build" | "other";

/** Lightweight agent row for Communication Canvas V2 — no `use server` barrel. */
export type AgentCommunicationCanvasRow = {
  id: string;
  slug: string | null;
  name: string;
  role: string;
  tier: number | null;
  avatarUrl: string | null;
  iconKey: string | null;
};

export function streamForAgentSlug(slug: string | null | undefined): CommunicationStream {
  if (!slug) return "other";
  if ((PRODUCT_STREAM_SLUGS as readonly string[]).includes(slug)) return "product";
  if ((BUILD_STREAM_SLUGS as readonly string[]).includes(slug)) return "build";
  return "other";
}
