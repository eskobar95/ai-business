"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CustomSelect } from "@/components/ui/custom-select";
import { NovelEditor } from "@/components/ui/novel-editor";
import { PrimaryButton } from "@/components/ui/primary-button";
import { createMission } from "@/lib/missions/actions";

const STATUS_OPTIONS = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
];

export function MissionCreateForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [prdHtml, setPrdHtml] = useState("<p></p>");
  const [pending, start] = useTransition();

  const canSubmit = useMemo(() => name.trim().length > 0 && !pending, [name, pending]);

  function handleSubmit() {
    start(async () => {
      try {
        const row = await createMission({
          businessId,
          name: name.trim(),
          status: status === "active" ? "active" : "draft",
          prd: prdHtml,
        });
        toast.success("Mission created.");
        router.push(
          `/dashboard/missions/${row.id}?businessId=${encodeURIComponent(businessId)}`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="section-label mb-1">Missions</p>
        <h1 className="text-xl font-semibold tracking-tight">New mission</h1>
      </div>

      <Link
        href={`/dashboard/missions?businessId=${encodeURIComponent(businessId)}`}
        className="w-fit cursor-pointer text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to missions
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="section-label" htmlFor="mission-name">
            Name
          </label>
          <input
            id="mission-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none ring-ring focus-visible:ring-2"
            placeholder="e.g. Payments v2"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="section-label" htmlFor="mission-status">
            Status
          </label>
          <CustomSelect id="mission-status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <p className="section-label">Product requirements</p>
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground/55">
          Supported blocks: headings, bold/italic, lists, blockquotes, code fences, horizontal rules
          — aligns with StarterKit so agents avoid unsupported constructs.
        </p>
        <NovelEditor initialContent={prdHtml} onHtmlChange={setPrdHtml} className="min-h-[320px]" />
      </section>

      <div className="flex justify-end gap-3">
        <PrimaryButton type="button" disabled={!canSubmit} loading={pending} onClick={handleSubmit}>
          {pending ? "Creating…" : "Create mission"}
        </PrimaryButton>
      </div>
    </div>
  );
}
