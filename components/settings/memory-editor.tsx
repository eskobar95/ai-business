"use client";

import { CircleHelp, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { PrimaryButton } from "@/components/ui/primary-button";
import { createBusinessMemorySection, updateMemoryContent } from "@/lib/settings/memory-actions";

const AUTOSAVE_MS = 3000;

export type MemorySectionInitial = {
  id: string;
  content: string;
  updatedAt: Date;
};

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

function formatUpdatedAt(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function MemorySectionCard({
  memoryId,
  initialContent,
  updatedAt,
  onScheduleSave,
}: {
  memoryId: string;
  initialContent: string;
  updatedAt: Date;
  onScheduleSave: (id: string, html: string) => void;
}) {
  const [localUpdatedAt, setLocalUpdatedAt] = useState(updatedAt);

  useEffect(() => {
    setLocalUpdatedAt(updatedAt);
  }, [updatedAt]);

  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-tier-faint">
          Updated {formatUpdatedAt(localUpdatedAt)}
        </span>
      </div>
      <TiptapEditor
        key={memoryId}
        initialContent={initialContent}
        className="min-h-[180px] rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-2"
        onUpdate={(html) => {
          setLocalUpdatedAt(new Date());
          onScheduleSave(memoryId, html);
        }}
      />
    </div>
  );
}

function sortSections(rows: MemorySectionInitial[]) {
  return [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function MemoryEditor({
  businessId,
  initialSections,
}: {
  businessId: string;
  initialSections: MemorySectionInitial[];
}) {
  const [sections, setSections] = useState<MemorySectionInitial[]>(() =>
    sortSections(initialSections),
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [addPending, startAdd] = useTransition();

  useEffect(() => {
    setSections(sortSections(initialSections));
  }, [initialSections]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const scheduleSave = useCallback((memoryId: string, html: string) => {
    const timers = timersRef.current;
    const prev = timers.get(memoryId);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      timers.delete(memoryId);
      void (async () => {
        try {
          await updateMemoryContent(memoryId, html);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save memory.");
        }
      })();
    }, AUTOSAVE_MS);
    timers.set(memoryId, t);
  }, []);

  function onAddSection() {
    startAdd(async () => {
      try {
        const { id } = await createBusinessMemorySection(businessId, "<p></p>");
        const now = new Date();
        setSections((prev) => [{ id, content: "<p></p>", updatedAt: now }, ...prev]);
        toast.success("New section added.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not add section.");
      }
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-muted-tier-faint flex items-start gap-1.5 text-[12px] leading-relaxed">
        <span>
          Business memory is injected into agent prompts when &apos;Include business context&apos; is enabled on
          the system role.
        </span>
        <FieldHint text="Business memory injiceres automatisk i agent-prompts hvor 'Include business context' er aktiveret på system role." />
      </p>

      <div>
        <PrimaryButton
          type="button"
          icon={Plus}
          disabled={addPending}
          loading={addPending}
          onClick={onAddSection}
        >
          Ny sektion
        </PrimaryButton>
      </div>

      {sections.length === 0 ? (
        <p className="text-[13px] text-muted-foreground/50">
          No business memory sections yet. Add one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {sections.map((s) => (
            <li key={s.id}>
              <MemorySectionCard
                memoryId={s.id}
                initialContent={s.content}
                updatedAt={s.updatedAt}
                onScheduleSave={scheduleSave}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
