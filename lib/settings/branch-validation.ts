/**
 * Pure branch-name validation for workspace settings (no "use server" — import from Server Actions only).
 */

/** Allowed characters for Git branch segments (letters, digits, -, _, ., /) — no backslash. */
const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9._/-]+$/;

export function normalizeBranchValue(raw: string | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

/** Validates a nullable branch field; null means cleared / unset. */
export function assertValidOptionalBranchField(fieldLabel: string, value: string | null): void {
  if (value === null) return;
  if (!BRANCH_NAME_PATTERN.test(value)) {
    throw new Error(
      `${fieldLabel} may only contain letters, numbers, hyphen, underscore, dot, and slash (no spaces).`,
    );
  }
}
