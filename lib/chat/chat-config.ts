/**
 * Feature flags for the universal chat shell.
 * Each surface (agent chat, Grill-Me, widget) enables a subset of AI Elements.
 */
export type ChatFeatures = {
  reasoning?: boolean;
  chainOfThought?: boolean;
  suggestions?: boolean;
  tools?: boolean;
  confirmation?: boolean;
  sources?: boolean;
  plan?: boolean;
  tasks?: boolean;
  /** Render `<mission>` proposal cards from assistant messages (Product Owner bridge). */
  missionProposals?: boolean;
  /** Compact layout (widget): tighter padding, no full-page chrome */
  compact?: boolean;
};

export const CHAT_CONFIGS = {
  agentChat: {
    reasoning: true,
    chainOfThought: true,
    suggestions: true,
    tools: true,
    confirmation: true,
    sources: true,
    plan: true,
    tasks: true,
    missionProposals: true,
  } satisfies ChatFeatures,

  grillMe: {
    suggestions: true,
  } satisfies ChatFeatures,

  widget: {
    reasoning: true,
    chainOfThought: true,
    compact: true,
  } satisfies ChatFeatures,
} as const;

export type ChatSurfaceKey = keyof typeof CHAT_CONFIGS;

export function resolveChatFeatures(
  features?: ChatFeatures | ChatSurfaceKey,
): ChatFeatures {
  if (!features) return CHAT_CONFIGS.agentChat;
  if (typeof features === "string") return CHAT_CONFIGS[features];
  return features;
}
