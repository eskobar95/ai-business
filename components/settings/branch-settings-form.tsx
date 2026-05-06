"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FieldHint } from "@/components/settings/field-hint";
import { PrimaryButton } from "@/components/ui/primary-button";
import { updateBusinessBranchSettings } from "@/lib/settings/branch-actions";

export function BranchSettingsForm({
  businessId,
  initialIntegrationBranch,
  initialReleaseBranch,
}: {
  businessId: string;
  initialIntegrationBranch: string | null;
  initialReleaseBranch: string | null;
}) {
  const [integrationBranch, setIntegrationBranch] = useState(
    initialIntegrationBranch ?? "",
  );
  const [releaseBranch, setReleaseBranch] = useState(initialReleaseBranch ?? "");
  const [pending, startSave] = useTransition();

  useEffect(() => {
    setIntegrationBranch(initialIntegrationBranch ?? "");
    setReleaseBranch(initialReleaseBranch ?? "");
  }, [initialIntegrationBranch, initialReleaseBranch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const integ = integrationBranch.trim();
    if (!integ) {
      toast.error("Integration branch is required.");
      return;
    }
    startSave(async () => {
      try {
        await updateBusinessBranchSettings(businessId, {
          integrationBranch: integ,
          releaseBranch: releaseBranch.trim() || null,
        });
        toast.success("Branch settings saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save branch settings.");
      }
    });
  }

  return (
    <section className="flex max-w-md flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="integrationBranch" className="label-upper">
              Integration branch
            </label>
            <FieldHint text="Branch agents sync from here; PRs merge here to satisfy automation gates." />
          </div>
          <input
            id="integrationBranch"
            name="integrationBranch"
            value={integrationBranch}
            onChange={(e) => setIntegrationBranch(e.target.value)}
            className="h-9 rounded-md border border-border bg-white/[0.04] px-3 text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50"
            placeholder="staging"
            required
            disabled={pending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="releaseBranch" className="label-upper">
              Release branch
            </label>
            <FieldHint text="Only humans merge here. Automation does not touch the release branch." />
          </div>
          <input
            id="releaseBranch"
            name="releaseBranch"
            value={releaseBranch}
            onChange={(e) => setReleaseBranch(e.target.value)}
            className="h-9 rounded-md border border-border bg-white/[0.04] px-3 text-[13px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-white/[0.16] focus:outline-none transition-colors disabled:opacity-50"
            placeholder="main"
            disabled={pending}
          />
        </div>

        <div>
          <PrimaryButton type="submit" disabled={pending} loading={pending}>
            {pending ? "Saving…" : "Save branch settings"}
          </PrimaryButton>
        </div>
      </form>
    </section>
  );
}
