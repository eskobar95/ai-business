"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { TemplatePreview } from "@/lib/templates/get-template-preview";
import { seedEnterpriseTemplateAction } from "@/lib/templates/seed-action";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "success" | "error";

export function TemplatePreviewModal({
  open,
  onOpenChange,
  businessId,
  preview,
  previewError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  preview: TemplatePreview | null;
  previewError: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const productAgents = preview?.agents.filter((a) => a.teamSlug === "product_team") ?? [];
  const buildAgents = preview?.agents.filter((a) => a.teamSlug === "engineering_team") ?? [];

  function resetAndClose(): void {
    setPhase("idle");
    setMessage(null);
    onOpenChange(false);
  }

  function activate(): void {
    setPhase("loading");
    setMessage(null);
    startTransition(async () => {
      const res = await seedEnterpriseTemplateAction(businessId);
      if (!res.ok) {
        setPhase("error");
        setMessage(res.error);
        return;
      }
      setPhase("success");
      setMessage(
        res.alreadySeeded
          ? "This workspace was already provisioned."
          : `Provisioned ${res.agents} agents, ${res.teams} teams, ${res.edges} edges, ${res.gates} gate kinds.`,
      );
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        aria-label="Close dialog backdrop"
        onClick={() => !pending && resetAndClose()}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 id="template-preview-title" className="text-[15px] font-semibold text-foreground">
              Enterprise template preview
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {preview
                ? `Version ${preview.templateVersion} · ${preview.edgeCount} communication edges`
                : "Preview unavailable"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !pending && resetAndClose()}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {(previewError || !preview) && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
              {previewError ??
                "Could not load the template bundle. Run `npm run templates:build` locally."}
            </div>
          )}

          {preview && phase !== "success" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <StreamColumn title="Product stream" agents={productAgents} accent="text-emerald-400/80" />
                <StreamColumn title="Build stream" agents={buildAgents} accent="text-sky-400/80" />
              </div>

              <div>
                <p className="section-label mb-2">Teams</p>
                <ul className="space-y-1 text-[12px] text-muted-foreground">
                  {preview.teams.map((t) => (
                    <li key={t.slug}>
                      <span className="text-foreground/90">{t.displayName}</span> · {t.stream}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="section-label mb-2">Gate types</p>
                <ul className="flex flex-wrap gap-1.5">
                  {preview.gateKinds.map((g) => (
                    <li
                      key={g.slug}
                      className="rounded-md border border-border bg-white/[0.03] px-2 py-0.5 text-[11px] text-foreground/85"
                    >
                      {g.label}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {phase === "success" && (
            <div className="rounded-md border border-success/30 bg-success/10 px-4 py-3">
              <p className="text-[13px] font-medium text-success">Your AI team is ready</p>
              {message && <p className="mt-1 text-[12px] text-muted-foreground">{message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="cursor-pointer">
                  <Link href={`/dashboard/agents?businessId=${encodeURIComponent(businessId)}`}>
                    Open agents
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="cursor-pointer">
                  <Link
                    href={`/dashboard/communication?businessId=${encodeURIComponent(businessId)}`}
                  >
                    Communication
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {phase === "error" && message && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {message}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
          {phase === "success" ? (
            <Button type="button" size="sm" className="cursor-pointer" onClick={resetAndClose}>
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                disabled={pending}
                onClick={resetAndClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                disabled={pending || phase === "loading"}
                onClick={activate}
              >
                {phase === "loading" || pending ? "Activating…" : "Activate"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StreamColumn({
  title,
  agents,
  accent,
}: {
  title: string;
  agents: TemplatePreview["agents"];
  accent: string;
}) {
  return (
    <div className="rounded-md border border-border bg-white/[0.02] p-3">
      <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-widest", accent)}>{title}</p>
      <ul className="space-y-2">
        {agents.map((a) => (
          <li key={a.slug} className="rounded border border-white/[0.06] bg-card px-2 py-1.5">
            <p className="text-[12px] font-medium text-foreground">{a.name}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2">{a.role}</p>
            <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/70">tier {a.tier}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
