"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { runProductOwnerBriefing } from "@/lib/missions/po-briefing-action";
import { PrimaryButton } from "@/components/ui/primary-button";

export function POBriefButton({
  missionId,
  businessId,
}: {
  missionId: string;
  businessId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <PrimaryButton
        type="button"
        icon={Rocket}
        disabled={pending}
        loading={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await runProductOwnerBriefing(businessId, missionId);
            if (result.success) {
              setMessage("Sprint brief oprettet — afventer godkendelse");
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
        className="w-fit gap-2"
      >
        Kickstart Product Owner
      </PrimaryButton>
      {message ? (
        <p className="text-[13px] text-emerald-500/90">{message}</p>
      ) : null}
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
    </div>
  );
}
