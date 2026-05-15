"use client";

import { Cpu, Loader2, Wrench } from "lucide-react";
import { useState, useTransition } from "react";

import { runEngineeringManagerDecomposition } from "@/lib/missions/em-decompose-action";

export function EMDecomposeButton(props: { approvalId: string; businessId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        className="border-border bg-background inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await runEngineeringManagerDecomposition(props.businessId, props.approvalId);
            if (result.success) {
              setMessage("Tasks oprettet — sprint er aktivt");
            } else {
              setError(result.error);
            }
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <>
            <Wrench className="size-4" aria-hidden />
            <Cpu className="size-4" aria-hidden />
          </>
        )}
        Start Engineering Manager
      </button>

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
