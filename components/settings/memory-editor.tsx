"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { FieldHint } from "@/components/settings/field-hint";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { PrimaryButton } from "@/components/ui/primary-button";
import { createBusinessMemorySection, updateMemoryContent } from "@/lib/settings/memory-actions";

const AUTOSAVE_MS = 3000;

export type MemorySectionInitial = {
  id: string;
  content: string;
  updatedAt: Date;
};

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
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-tier-faint">
          Updated {formatUpdatedAt(updatedAt)}
        </span>
      </div>
      <TiptapEditor
        key={memoryId}
        initialContent={initialContent}
        className="min-h-[180px] rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-2"
        onUpdate={(html) => onScheduleSave(memoryId, html)}
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

  /** Stable across parent re-renders that only change array identity, not server rows. */
  const serverSectionsSignature = useMemo(
    () =>
      [...initialSections]
        .map((s) => `${s.id}:${s.updatedAt.getTime()}`)
        .sort()
        .join("|"),
    [initialSections],
  );

  useEffect(() => {
    setSections(sortSections(initialSections));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gate on serverSectionsSignature + businessId to avoid clobbering editors when `initialSections` is a new array reference with identical data
  }, [businessId, serverSectionsSignature]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const bumpSectionUpdatedAt = useCallback((memoryId: string) => {
    const now = new Date();
    setSections((prev) =>
      sortSections(
        prev.map((s) => (s.id === memoryId ? { ...s, updatedAt: now } : s)),
      ),
    );
  }, []);

  const scheduleSave = useCallback(
    (memoryId: string, html: string) => {
      const timers = timersRef.current;
      const prev = timers.get(memoryId);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        timers.delete(memoryId);
        void (async () => {
          try {
            await updateMemoryContent(memoryId, html);
            bumpSectionUpdatedAt(memoryId);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save memory.");
          }
        })();
      }, AUTOSAVE_MS);
      timers.set(memoryId, t);
    },
    [bumpSectionUpdatedAt],
  );

  function onAddSection() {
    startAdd(async () => {
      try {
        const { id } = await createBusinessMemorySection(businessId, "<p></p>");
        const now = new Date();
        setSections((prev) => sortSections([{ id, content: "<p></p>", updatedAt: now }, ...prev]));
        toast.success("Section added.");
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
        <FieldHint text="Shown in agent runs when the system role has business context injection turned on." />
      </p>

      <div>
        <PrimaryButton
          type="button"
          icon={Plus}
          disabled={addPending}
          loading={addPending}
          onClick={onAddSection}
        >
          New section
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
