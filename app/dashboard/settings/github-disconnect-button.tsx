"use client";

import { disconnectGithubInstallation } from "@/lib/github/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function GithubDisconnectButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      {!confirming ?
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          data-testid="github-disconnect-start"
          onClick={() => setConfirming(true)}
        >
          Disconnect
        </Button>
      : <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            data-testid="github-disconnect-confirm"
            onClick={() => {
              startTransition(async () => {
                await disconnectGithubInstallation(businessId);
                setConfirming(false);
                router.refresh();
              });
            }}
          >
            Confirm disconnect
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      }
    </div>
  );
}
