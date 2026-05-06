"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrimaryButton } from "@/components/ui/primary-button";
import { updateBusinessCursorDefaults } from "@/lib/settings/branch-actions";

const PLATFORM_DEFAULT = "__platform_default__";

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: PLATFORM_DEFAULT, label: "Platform default (composer-2)" },
  { value: "auto", label: "Auto (Cursor vælger)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-opus-4", label: "Claude Opus 4" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const EFFORT_OPTIONS: { value: string; label: string }[] = [
  { value: PLATFORM_DEFAULT, label: "Platform default" },
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function FieldHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex cursor-help text-muted-foreground/40"
      title={text}
      aria-label={text}
    >
      <CircleHelp className="size-3.5" />
    </span>
  );
}

function toSelectModel(initial: string | null): string {
  if (initial == null) return PLATFORM_DEFAULT;
  return MODEL_OPTIONS.some((o) => o.value === initial) ? initial : PLATFORM_DEFAULT;
}

function toSelectEffort(initial: string | null): string {
  if (initial == null) return PLATFORM_DEFAULT;
  return EFFORT_OPTIONS.some((o) => o.value === initial) ? initial : PLATFORM_DEFAULT;
}

export function CursorDefaultsForm({
  businessId,
  initialDefaultCursorModelId,
  initialDefaultCursorThinkingEffort,
}: {
  businessId: string;
  initialDefaultCursorModelId: string | null;
  initialDefaultCursorThinkingEffort: string | null;
}) {
  const [model, setModel] = useState(() => toSelectModel(initialDefaultCursorModelId));
  const [effort, setEffort] = useState(() => toSelectEffort(initialDefaultCursorThinkingEffort));
  const [pending, startSave] = useTransition();

  useEffect(() => {
    setModel(toSelectModel(initialDefaultCursorModelId));
    setEffort(toSelectEffort(initialDefaultCursorThinkingEffort));
  }, [initialDefaultCursorModelId, initialDefaultCursorThinkingEffort]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startSave(async () => {
      try {
        await updateBusinessCursorDefaults(businessId, {
          defaultCursorModelId: model === PLATFORM_DEFAULT ? null : model,
          defaultCursorThinkingEffort: effort === PLATFORM_DEFAULT ? null : effort,
        });
        toast.success("Cursor defaults saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save Cursor defaults.");
      }
    });
  }

  return (
    <section className="flex max-w-md flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="cursor-model" className="label-upper">
              Default model
            </label>
            <FieldHint text="`auto` = Cursor vælger. Agenter med 'inherit' arver dette valg." />
          </div>
          <Select value={model} onValueChange={setModel} disabled={pending}>
            <SelectTrigger
              id="cursor-model"
              className="h-9 w-full border-border bg-white/[0.04] text-[13px]"
            >
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="cursor-thinking" className="label-upper">
              Default thinking effort
            </label>
            <FieldHint text="Påvirker svardybde og token-forbrug." />
          </div>
          <Select value={effort} onValueChange={setEffort} disabled={pending}>
            <SelectTrigger
              id="cursor-thinking"
              className="h-9 w-full border-border bg-white/[0.04] text-[13px]"
            >
              <SelectValue placeholder="Select effort" />
            </SelectTrigger>
            <SelectContent>
              {EFFORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <PrimaryButton type="submit" disabled={pending} loading={pending}>
            {pending ? "Saving…" : "Save Cursor defaults"}
          </PrimaryButton>
        </div>
      </form>
    </section>
  );
}
