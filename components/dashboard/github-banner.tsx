import Link from "next/link";

import { Button } from "@/components/ui/button";

export function GitHubBanner({
  businessId,
  isConnected,
}: {
  businessId: string;
  isConnected: boolean;
}) {
  if (isConnected) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-muted-foreground">
        Connect GitHub so your agents can commit, open PRs and review code.
      </p>
      <Button asChild size="sm" variant="outline" className="shrink-0 cursor-pointer">
        <Link href={`/dashboard/settings/integrations?businessId=${encodeURIComponent(businessId)}`}>
          Connect GitHub
        </Link>
      </Button>
    </div>
  );
}
