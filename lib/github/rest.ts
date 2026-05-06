import { createGithubAppJwt } from "@/lib/github/app-jwt";

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

async function appBearerHeaders(): Promise<HeadersInit> {
  const jwt = await createGithubAppJwt();
  return {
    ...GH_HEADERS,
    Authorization: `Bearer ${jwt}`,
    "User-Agent": "ai-business-platform-github-app",
  };
}

async function userBearerHeaders(token: string): Promise<HeadersInit> {
  return {
    ...GH_HEADERS,
    Authorization: `Bearer ${token}`,
    "User-Agent": "ai-business-platform-github-app-installation",
  };
}

export async function githubFetchInstallationRaw(installationId: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: await appBearerHeaders(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub installation fetch failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as unknown;
}

export async function githubCreateInstallationAccessToken(
  installationId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: await appBearerHeaders(),
      body: "{}",
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub installation token exchange failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const body = (await res.json()) as { token?: string; expires_at?: string };
  if (!body.token || !body.expires_at) throw new Error("GitHub installation token response invalid");
  return { token: body.token, expiresAt: new Date(body.expires_at) };
}

export async function githubListInstallationRepositoryFullNames(accessToken: string): Promise<string[]> {
  const res = await fetch(`https://api.github.com/installation/repositories?per_page=100`, {
    headers: await userBearerHeaders(accessToken),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub list repositories failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    repositories?: { full_name?: string }[];
  };
  const repos = json.repositories ?? [];
  return repos
    .map((r) => r.full_name)
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .slice(0, 200);
}

/**
 * Revokes the **current** installation access token (invalidates it on GitHub immediately).
 * @see https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#revoke-an-installation-access-token
 */
export async function githubRevokeInstallationAccessToken(accessToken: string): Promise<void> {
  const res = await fetch("https://api.github.com/installation/token", {
    method: "DELETE",
    headers: await userBearerHeaders(accessToken),
  });
  if (res.ok || res.status === 404) return;
  const txt = await res.text().catch(() => "");
  throw new Error(`GitHub revoke installation token failed: ${res.status} ${txt.slice(0, 200)}`);
}

export function parseGithubInstallationAccount(raw: unknown): {
  login: string;
  type: "User" | "Organization";
} {
  if (!raw || typeof raw !== "object") throw new Error("Invalid installation payload");
  const inst = raw as { account?: { login?: string; type?: string } };
  const account = inst.account;
  if (!account?.login || !account?.type) {
    throw new Error("Installation account missing login/type");
  }
  const lt = account.type.toLowerCase();
  if (lt === "organization") return { login: account.login, type: "Organization" };
  if (lt === "user") return { login: account.login, type: "User" };
  throw new Error(`Unsupported GitHub account type: ${account.type}`);
}
