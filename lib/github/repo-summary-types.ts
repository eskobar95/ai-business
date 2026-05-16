/** Serializable repo snapshot for UI (wizard, badges). Safe to import from Client Components. */

export type RepoSummary = {
  repoName: string;
  repoUrl: string;
  topLevel: { name: string; type: "file" | "dir" }[];
  recentCommits: { sha: string; message: string; date: string }[];
};
