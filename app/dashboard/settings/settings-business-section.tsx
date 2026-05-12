"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";

import type { SettingsBusinessRow } from "@/lib/settings/actions";
import { saveBusinessSettings } from "@/lib/settings/actions";
import { PrimaryButton } from "@/components/ui/primary-button";

export function SettingsBusinessSection({
  businessId,
  business,
}: {
  businessId: string;
  business: SettingsBusinessRow;
}) {
  const [localPath, setLocalPath] = useState(business.localPath ?? "");
  const [githubRepoUrl, setGithubRepoUrl] = useState(business.githubRepoUrl ?? "");
  const [description, setDescription] = useState(business.description ?? "");
  const [businessPending, startBusinessSave] = useTransition();

  useEffect(() => {
    setLocalPath(business.localPath ?? "");
    setGithubRepoUrl(business.githubRepoUrl ?? "");
    setDescription(business.description ?? "");
  }, [business]);

  async function onSaveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) {
      toast.error("Select a workspace first.");
      return;
    }
    startBusinessSave(async () => {
      const result = await saveBusinessSettings(businessId, {
        localPath: localPath.trim() || undefined,
        githubRepoUrl: githubRepoUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
      if (result.success) {
        toast.success("Workspace settings saved.");
      } else {
        toast.error("Could not save workspace settings.");
      }
    });
  }

  return (
    <section className="flex max-w-md flex-col gap-5">
      <form onSubmit={onSaveBusiness} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="localPath" className="label-upper">
            Local path
          </label>
          <input
            id="localPath"
            name="localPath"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            className="h-9 rounded-md border border-border bg-white/[0.04] px-3 text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50"
            placeholder="/path/to/repo"
            disabled={businessPending}
          />
          <p className="text-muted-tier-faint text-[11px]">
            Absolute path to the project on your machine, e.g. /Users/you/projects/myapp
          </p>
        </div>

        {business.githubInstallation ? (
          <div className="flex flex-col gap-1.5">
            <span className="label-upper">GitHub repositories</span>
            <div className="rounded-md border border-border bg-white/[0.02] px-3 py-2">
              {(() => {
                const inst = business.githubInstallation!;
                const active = inst.selectedRepos ?? inst.repos;
                if (active.length === 0) {
                  return (
                    <p className="text-[12px] text-muted-foreground">
                      No repositories selected.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-0.5">
                    {active.slice(0, 8).map((r) => (
                      <li key={r} className="font-mono text-[12px] text-foreground/80">{r}</li>
                    ))}
                    {active.length > 8 && (
                      <li className="text-[11px] text-muted-foreground">+{active.length - 8} more</li>
                    )}
                  </ul>
                );
              })()}
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Managed in{" "}
              <Link
                href={`/dashboard/settings?businessId=${businessId}&section=integrations`}
                className="text-primary hover:underline"
              >
                Settings → Integrations
              </Link>
              . The first selected repo is used for Grill-Me reasoning.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="githubRepoUrl" className="label-upper">
              GitHub repository URL
            </label>
            <input
              id="githubRepoUrl"
              name="githubRepoUrl"
              value={githubRepoUrl}
              onChange={(e) => setGithubRepoUrl(e.target.value)}
              className="h-9 rounded-md border border-border bg-white/[0.04] px-3 text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50"
              placeholder="https://github.com/org/repo"
              disabled={businessPending}
            />
            <p className="text-[11px] text-muted-foreground/60">
              Used for Grill-Me reasoning until GitHub App is connected.{" "}
              <Link
                href={`/dashboard/settings?businessId=${businessId}&section=integrations`}
                className="text-primary hover:underline"
              >
                Connect GitHub App
              </Link>{" "}
              to manage multiple repos.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="label-upper">
            Description / Notes
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[88px] rounded-md border border-border bg-white/[0.04] px-3 py-2 text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50 resize-none"
            placeholder="Optional notes about this workspace"
            disabled={businessPending}
          />
          <p className="text-muted-tier-faint text-[11px]">Optional notes about this workspace.</p>
        </div>

        <div>
          <PrimaryButton type="submit" disabled={businessPending} loading={businessPending}>
            {businessPending ? "Saving…" : "Save workspace settings"}
          </PrimaryButton>
        </div>
      </form>
    </section>
  );
}
