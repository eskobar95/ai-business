import { assertValidAgentAvatarUrl, normalizeAgentIconKeyForSave } from "@/lib/agents/avatar-validation";
import type { AgentPlatformIconId } from "@/lib/agents/agent-platform-icon-ids";

/**
 * Resolved DB columns from a client patch (validated). Used by `updateAgent` so rules stay testable.
 * Returns null when neither field should be touched.
 */
export function resolveAvatarColumnsForUpsert(patch: {
  avatarUrl?: string | null;
  iconKey?: string | null;
}): { avatarUrl?: string | null; iconKey?: AgentPlatformIconId | null } | null {
  if (patch.avatarUrl === undefined && patch.iconKey === undefined) {
    return null;
  }

  const cols: {
    avatarUrl?: string | null;
    iconKey?: AgentPlatformIconId | null;
  } = {};

  if (patch.avatarUrl !== undefined) {
    const avatarValue = patch.avatarUrl;
    if (avatarValue === null || avatarValue.trim() === "") {
      cols.avatarUrl = null;
    } else {
      assertValidAgentAvatarUrl(avatarValue);
      cols.avatarUrl = avatarValue.trim();
    }
  }

  if (patch.iconKey !== undefined) {
    cols.iconKey = normalizeAgentIconKeyForSave(patch.iconKey);
  }

  return cols;
}
