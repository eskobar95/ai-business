"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MarkdownEditorField } from "@/components/agents/markdown-editor-field";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { createAgent } from "@/lib/agents/actions";
import type { agents } from "@/db/schema";

type Peer = Pick<typeof agents.$inferSelect, "id" | "name" | "isPlatformDefault">;

export function NewAgentWizard({ businessId, peerAgents }: { businessId: string; peerAgents: Peer[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reportsToAgentId, setReportsToAgentId] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createAgent({
          businessId,
          name,
          role,
          instructions,
          reportsToAgentId,
        });
        toast.success("Agent created.");
        router.push(
          `/dashboard/agents/${created.id}?businessId=${encodeURIComponent(businessId)}&onboarding=1`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <span className={step >= 1 ? "text-primary" : ""}>1 Identity</span>
        <span aria-hidden>→</span>
        <span className={step >= 2 ? "text-primary" : ""}>2 Configuration</span>
        <span aria-hidden>→</span>
        <span className={step >= 3 ? "text-primary" : ""}>3 Review</span>
      </div>

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="na-name">
              Name
            </label>
            <input
              id="na-name"
              data-testid="agent-name"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="na-role">
              Role
            </label>
            <input
              id="na-role"
              data-testid="agent-role"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Instructions</span>
            <MarkdownEditorField
              value={instructions}
              onChange={setInstructions}
              data-testid="agent-instructions-editor"
            />
          </div>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => setStep(2)}
            disabled={!name.trim() || !role.trim() || !instructions.trim()}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="na-reports">
              Reports to
            </label>
            <select
              id="na-reports"
              data-testid="agent-reports-to"
              className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              value={reportsToAgentId ?? ""}
              onChange={(e) =>
                setReportsToAgentId(e.target.value.length ? e.target.value : null)
              }
            >
              <option value="">— None —</option>
              {peerAgents
                .filter((p) => !p.isPlatformDefault)
                .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" className="cursor-pointer" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div className="border-border bg-muted/40 rounded-lg border p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {name}
            </p>
            <p className="mt-2">
              <span className="text-muted-foreground">Role:</span> {role}
            </p>
            <p className="mt-2">
              <span className="text-muted-foreground">Reports to:</span>{" "}
              {reportsToAgentId
                ? peerAgents.find((p) => p.id === reportsToAgentId)?.name ?? "—"
                : "—"}
            </p>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setStep(2)}>
              Back
            </Button>
            <LoadingButton
              type="button"
              data-testid="agent-save"
              className="cursor-pointer"
              loading={pending}
              onClick={create}
            >
              Create agent
            </LoadingButton>
          </div>
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">
        <Link
          href={`/dashboard/agents?businessId=${encodeURIComponent(businessId)}`}
          className="hover:text-foreground cursor-pointer underline"
        >
          Cancel
        </Link>
      </p>
    </div>
  );
}
