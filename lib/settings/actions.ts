"use server";

import { verifyCursorApiKey } from "@/lib/cursor/verify-api-key";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { getDb } from "@/db/index";
import { businesses, githubInstallations, githubInstallationSelectedRepos, memory, userBusinesses, userSettings } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireSessionUserId } from "@/lib/roster/session";
import { encryptCredential } from "@/lib/mcp/encryption";

/** Payload field name inside encrypted JSON `{ cursorApiKey: string }`. */
const CURSOR_KEY_FIELD = "cursorApiKey";

async function persistEncryptedCursorApiKey(
  userId: string,
  plainCursorKey: string,
): Promise<void> {
  const db = getDb();
  const trimmed = plainCursorKey.trim();
  const now = new Date();

  if (!trimmed) {
    await db
      .insert(userSettings)
      .values({
        userId,
        cursorApiKeyEncrypted: null,
        cursorApiKeyIv: null,
      })
      .onConflictDoUpdate({
        target: [userSettings.userId],
        set: {
          cursorApiKeyEncrypted: null,
          cursorApiKeyIv: null,
          updatedAt: now,
        },
      });
    return;
  }

  const envelope = encryptCredential({ [CURSOR_KEY_FIELD]: trimmed });

  await db
    .insert(userSettings)
    .values({
      userId,
      cursorApiKeyEncrypted: envelope.encryptedPayload,
      cursorApiKeyIv: envelope.ivBase64,
    })
    .onConflictDoUpdate({
      target: [userSettings.userId],
      set: {
        cursorApiKeyEncrypted: envelope.encryptedPayload,
        cursorApiKeyIv: envelope.ivBase64,
        updatedAt: now,
      },
    });
}

export type VerifyAndSaveCursorApiKeyResult =
  | { success: true }
  | { success: false; message: string };

/**
 * Validates non-empty keys with Cursor (`Cursor.me`), then persists encrypted to `user_settings`.
 * Empty / whitespace clears stored credentials — no Cursor call (matches Settings UX).
 */
export async function verifyAndSaveCursorApiKey(
  cursorApiKey: string,
): Promise<VerifyAndSaveCursorApiKeyResult> {
  const userId = await requireSessionUserId();
  const trimmed = cursorApiKey.trim();
  if (!trimmed) {
    await persistEncryptedCursorApiKey(userId, "");
    return { success: true };
  }

  const verified = await verifyCursorApiKey(trimmed);
  if (!verified.ok) {
    const byReason = {
      invalid_credentials: "That key was rejected by Cursor. Check paste and permissions.",
      rate_limited: "Cursor rate limited this check. Wait a minute and try again.",
      network: "Could not reach Cursor. Check your connection and try again.",
      unknown: "Could not validate the key. Try again.",
    } as const;
    return { success: false, message: byReason[verified.reason] };
  }

  await persistEncryptedCursorApiKey(userId, trimmed);
  return { success: true };
}

/**
 * Same as `verifyAndSaveCursorApiKey` — Settings Account form entry point.
 */
export async function saveUserSettings(
  cursorApiKey: string,
): Promise<VerifyAndSaveCursorApiKeyResult> {
  return verifyAndSaveCursorApiKey(cursorApiKey);
}

export async function saveBusinessSettings(
  businessId: string,
  data: { localPath?: string; githubRepoUrl?: string; description?: string },
): Promise<{ success: true }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);

  const db = getDb();
  await db
    .update(businesses)
    .set({
      ...(data.localPath !== undefined ? { localPath: data.localPath.trim() || null } : {}),
      ...(data.githubRepoUrl !== undefined
        ? { githubRepoUrl: data.githubRepoUrl.trim() || null }
        : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
    })
    .where(eq(businesses.id, businessId));

  return { success: true };
}

export async function saveBusinessProfile(
  businessId: string,
  data: { name?: string; websiteUrl?: string; description?: string },
): Promise<{ success: true }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  await db
    .update(businesses)
    .set({
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
    })
    .where(eq(businesses.id, businessId));
  return { success: true };
}

export type SettingsBusinessRow = {
  id: string;
  name: string;
  localPath: string | null;
  githubRepoUrl: string | null;
  description: string | null;
  websiteUrl: string | null; // placeholder — not in DB yet
  integrationBranch: string | null;
  releaseBranch: string | null;
  maxParallelRuns: number | null;
  defaultCursorModelId: string | null;
  defaultCursorThinkingEffort: string | null;
  memorySections: Array<{ id: string; content: string; updatedAt: Date }>;
  /** Repos from GitHub App installation (available + selected). Null if not connected. */
  githubInstallation: {
    repos: string[];
    /** Explicitly selected repos from child table. Empty = no selection → fall back to all repos. */
    selectedRepos: string[];
    accountLogin: string;
  } | null;
};

/**
 * Server-only snapshot for the Settings page: masked key indicator + per-business fields.
 */
export async function getSettingsPageState(): Promise<{
  hasCursorApiKey: boolean;
  businesses: SettingsBusinessRow[];
}> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
    columns: { cursorApiKeyEncrypted: true },
  });
  const hasCursorApiKey = settings?.cursorApiKeyEncrypted != null;

  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      localPath: businesses.localPath,
      githubRepoUrl: businesses.githubRepoUrl,
      description: businesses.description,
      integrationBranch: businesses.integrationBranch,
      releaseBranch: businesses.releaseBranch,
      maxParallelRuns: businesses.maxParallelRuns,
      defaultCursorModelId: businesses.defaultCursorModelId,
      defaultCursorThinkingEffort: businesses.defaultCursorThinkingEffort,
    })
    .from(userBusinesses)
    .innerJoin(businesses, eq(userBusinesses.businessId, businesses.id))
    .where(eq(userBusinesses.userId, userId));

  const businessIds = rows.map((r) => r.id);

  const installationRows =
    businessIds.length > 0
      ? await db
          .select({
            id: githubInstallations.id,
            businessId: githubInstallations.businessId,
            repos: githubInstallations.repos,
            accountLogin: githubInstallations.accountLogin,
          })
          .from(githubInstallations)
          .where(inArray(githubInstallations.businessId, businessIds))
      : [];

  const installationIds = installationRows.map((i) => i.id);
  const selectedRepoRows =
    installationIds.length > 0
      ? await db
          .select({
            installationId: githubInstallationSelectedRepos.installationId,
            repoUrl: githubInstallationSelectedRepos.repoUrl,
          })
          .from(githubInstallationSelectedRepos)
          .where(inArray(githubInstallationSelectedRepos.installationId, installationIds))
      : [];

  const selectedReposByInstallation = new Map<string, string[]>();
  for (const row of selectedRepoRows) {
    const list = selectedReposByInstallation.get(row.installationId) ?? [];
    list.push(row.repoUrl);
    selectedReposByInstallation.set(row.installationId, list);
  }

  const installationByBusiness = new Map(
    installationRows.map((i) => [i.businessId, {
      ...i,
      selectedRepos: selectedReposByInstallation.get(i.id) ?? [],
    }]),
  );

  const memoryRows =
    businessIds.length > 0
      ? await db
          .select({
            businessId: memory.businessId,
            id: memory.id,
            content: memory.content,
            updatedAt: memory.updatedAt,
          })
          .from(memory)
          .where(
            and(
              eq(memory.scope, "business"),
              isNull(memory.agentId),
              inArray(memory.businessId, businessIds),
            ),
          )
          .orderBy(desc(memory.updatedAt))
      : [];

  const memoryByBusiness = new Map<
    string,
    Array<{ id: string; content: string; updatedAt: Date }>
  >();
  for (const m of memoryRows) {
    const list = memoryByBusiness.get(m.businessId) ?? [];
    list.push({ id: m.id, content: m.content, updatedAt: m.updatedAt });
    memoryByBusiness.set(m.businessId, list);
  }

  const businessRows: SettingsBusinessRow[] = rows.map((r) => {
    const inst = installationByBusiness.get(r.id);
    return {
      ...r,
      websiteUrl: null, // not yet in DB schema
      memorySections: memoryByBusiness.get(r.id) ?? [],
      githubInstallation: inst
        ? { repos: inst.repos, selectedRepos: inst.selectedRepos, accountLogin: inst.accountLogin }
        : null,
    };
  });

  return { hasCursorApiKey, businesses: businessRows };
}
