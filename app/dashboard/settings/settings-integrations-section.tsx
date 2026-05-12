import { GithubDisconnectButton } from "@/app/dashboard/settings/github-disconnect-button";
import { GithubRepoSelector } from "@/app/dashboard/settings/github-repo-selector";
import { fetchGithubInstallationForBusiness } from "@/lib/github/installation-queries";
import { cn } from "@/lib/utils";

export async function SettingsIntegrationsSection({
  businessId,
  flash,
}: {
  businessId: string;
  flash?: string;
}) {
  const row = await fetchGithubInstallationForBusiness(businessId);
  const connected = Boolean(row?.installationId);

  const banner =
    flash === "connected" ? (
      <p className="border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mb-4 rounded-lg border px-3 py-2 text-xs">
        GitHub App connected successfully. Tokens stay on the server and refresh automatically before
        expiry.
      </p>
    ) : flash === "missing_context" ? (
      <p className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border px-3 py-2 text-xs">
        Install could not be linked to a workspace (missing or expired cookie, or finished in another
        browser). Open{' '}
        <span className="font-medium">Integrations</span>
        {' '}in the same workspace where you clicked Connect and run the flow again.
      </p>
    ) : flash === "setup_error" || flash === "forbidden" ? (
      <p className="border-destructive/40 bg-destructive/10 text-destructive mb-4 rounded-lg border px-3 py-2 text-xs">
        GitHub connection failed. Check server logs or try again from Integrations.
      </p>
    ) : flash === "cancelled" || flash === "no_installation" ? (
      <p className="border-border bg-muted/30 mb-4 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        Installation was cancelled or did not finish.
      </p>
    ) : null;

  return (
    <div className="max-w-xl space-y-4">
      {banner}

      <div className={cn("border-border bg-card/40 rounded-xl border p-5")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">GitHub</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Install the Conduro GitHub App so agents can work with repositories under your
              organisation. Callback URL must point to <code className="font-mono">/api/github/callback</code>{" "}
              in GitHub App settings.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              connected ?
                "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground",
            )}
            data-testid="github-integration-status"
          >
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-xs">
          {connected ?
            <>
              <p>
                <span className="text-muted-foreground">Account:</span>{" "}
                <span className="font-mono text-foreground">@{row?.accountLogin}</span> ({row?.accountType})
              </p>
              <p className="text-muted-foreground">
                Installation ID:{" "}
                <span className="text-foreground font-mono">{row?.installationId}</span>
              </p>
              {(row?.repos?.length ?? 0) > 0 ? (
                <div className="pt-1">
                  <p className="text-muted-foreground font-medium">
                    Repositories ({row!.repos.length} available via GitHub App)
                  </p>
                  <GithubRepoSelector
                    businessId={businessId}
                    allRepos={row!.repos}
                    initialSelected={(row?.selectedRepos?.length ?? 0) > 0 ? row!.selectedRepos : null}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">No repos reported yet. Try reconfiguring on GitHub.</p>
              )}
            </>
          : <p className="text-muted-foreground">
              Connect installs the GitHub App for this workspace. You will grant repository access from
              GitHub&apos;s UI.
            </p>
          }
        </div>

        {connected ?
          <p className="border-border bg-muted/20 text-muted-foreground mt-4 rounded-lg border px-3 py-2 text-[11px] leading-relaxed">
            <span className="text-foreground font-medium">Disconnect</span> removes this workspace&apos;s
            link and stored token on Conduro. It does{' '}
            <span className="text-foreground font-medium">not</span> uninstall the GitHub App from your
            user or organisation; remove the app under GitHub{' '}
            <span className="font-medium">Settings → Applications</span>
            {' '}if you want it gone org-wide.
          </p>
        : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className={cn(
              "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-xs font-semibold tracking-tight",
            )}
            data-testid="github-connect-link"
            href={`/api/github/install?businessId=${encodeURIComponent(businessId)}`}
          >
            {connected ? "Reconfigure on GitHub" : "Connect GitHub"}
          </a>
          {connected ?
            <GithubDisconnectButton businessId={businessId} />
          : null}
        </div>
      </div>
    </div>
  );
}
