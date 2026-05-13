import type { GithubInstallationRow } from "@/lib/github/installation-db";

/** Non-sensitive rows for dashboards (no ciphertext / IV). */
export type GithubInstallationPublic = Pick<
  GithubInstallationRow,
  "installationId" | "accountLogin" | "accountType" | "repos" | "updatedAt"
> & {
  /** Explicit repo selection from child table. Null = no selection → all repos. */
  selectedRepos: string[] | null;
};
