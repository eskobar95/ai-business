/**
 * Returns whether the GitHub App is installed for this business.
 *
 * TODO(stream-c): Query `github_installations` (or equivalent) once Stream C merges.
 */
export async function getGitHubInstalled(_businessId: string): Promise<boolean> {
  void _businessId;
  return false;
}
