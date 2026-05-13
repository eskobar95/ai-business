"use client";

import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Link2,
  Loader2,
  MoreHorizontal,
  Paperclip,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createLowlight, all as lowlightAll } from "lowlight";
import { toast } from "sonner";
import {
  CommentEditor,
  type CommentEditorHandle,
  type MentionItem,
} from "@/components/ui/comment-editor";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/hooks/use-outside-click";
import {
  relativeTime,
} from "@/lib/tasks/task-detail-display";
import {
  getAuthorLabel,
  getMonogram,
  hastToHtml,
} from "@/lib/tasks/task-detail-helpers";
import type { LogEntry } from "@/lib/tasks/task-detail-types";
import { appendTaskLog } from "@/lib/tasks/log-actions";

const lw = createLowlight(lowlightAll);

export function SystemEventRow({ log }: { log: LogEntry }) {
  return (
    <div className="flex items-center gap-3 py-1 animate-in fade-in-0 duration-300">
      <div className="size-6 shrink-0 flex items-center justify-center">
        <div className="size-1.5 rounded-full bg-white/[0.15]" />
      </div>
      <span className="text-[12px] text-muted-foreground/45 leading-relaxed flex-1">
        {log.content}
        <time className="ml-2 font-mono text-[10px] text-muted-foreground/25">
          · {relativeTime(log.createdAt)}
        </time>
      </span>
    </div>
  );
}

function CommentContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const blocks = ref.current.querySelectorAll("pre code");
    blocks.forEach((block) => {
      const el = block as HTMLElement;
      const lang = (el.className.match(/language-(\w+)/) ?? [])[1] ?? "plaintext";
      const code = el.textContent ?? "";
      if (!code.trim()) return;
      try {
        const tree = lw.highlight(lang, code);
        el.innerHTML = hastToHtml(tree);
      } catch {
        // silently ignore unknown languages
      }
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className="comment-rendered text-[13px] text-foreground/80 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const DEMO_SYSTEM_EVENTS: LogEntry[] = [
  {
    id: "demo-1",
    authorType: "system",
    authorId: "system",
    content: "Task created",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "demo-2",
    authorType: "system",
    authorId: "system",
    content: "Status changed from Backlog → In Progress",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "demo-3",
    authorType: "system",
    authorId: "system",
    content: "Priority set to Medium",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
];

export function ActivityFeed({
  logs,
  agentNames,
  currentUserId,
}: {
  logs: LogEntry[];
  agentNames: Record<string, string>;
  currentUserId: string;
}) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef as RefObject<HTMLElement | null>, () => setOpenMenuId(null), openMenuId !== null);

  const allEntries = [...DEMO_SYSTEM_EVENTS, ...logs];

  async function handleCopyLink(id: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.href}#comment-${id}`);
      toast.success("Copied", { duration: 1500 });
    } catch {
      toast.error("Copy failed");
    }
    setOpenMenuId(null);
  }

  if (allEntries.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground/30 italic" data-testid="task-log-empty">
        No activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5" data-testid="task-log-feed">
      {allEntries.map((entry) => {
        if (entry.authorType === "system") {
          return <SystemEventRow key={entry.id} log={entry} />;
        }

        if (resolvedIds.has(entry.id)) {
          return (
            <div
              key={entry.id}
              className="flex items-center gap-2 py-2 pl-1 text-[11px] text-muted-foreground/40 cursor-pointer hover:text-muted-foreground/60 transition-colors select-none"
              onClick={() =>
                setResolvedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(entry.id);
                  return next;
                })
              }
            >
              <div className="size-6 shrink-0 flex items-center justify-center">
                <div className="size-4 rounded-full border border-white/[0.12] flex items-center justify-center">
                  <X className="size-2.5 text-white/20" />
                </div>
              </div>
              <span>1 resolved comment from {getAuthorLabel(entry, currentUserId, agentNames)}</span>
              <ChevronDown className="size-3 ml-1 opacity-50" />
            </div>
          );
        }

        const label = getAuthorLabel(entry, currentUserId, agentNames);
        const monogram = getMonogram(entry, currentUserId, agentNames);
        const timeStr = entry.createdAt.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const isMenuOpen = openMenuId === entry.id;

        return (
          <div
            key={entry.id}
            id={`comment-${entry.id}`}
            data-testid={`task-log-entry-${entry.id}`}
            className="group relative flex gap-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors animate-in fade-in-0 duration-300"
          >
            <div className="size-6 shrink-0 mt-0.5 rounded-full bg-white/[0.07] flex items-center justify-center font-mono text-[9px] text-foreground/40">
              {monogram}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-[12px] font-medium text-foreground/70">{label}</span>
                <time className="font-mono text-[10px] text-muted-foreground/30">{timeStr}</time>
              </div>
              <CommentContent html={entry.content} />
            </div>
            <div className="relative shrink-0 self-start mt-0.5">
              <button
                type="button"
                onClick={() => setOpenMenuId(isMenuOpen ? null : entry.id)}
                className="hidden group-hover:flex items-center justify-center size-6 rounded-md text-muted-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-colors"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  className="dropdown-animate absolute right-0 top-full mt-1 z-50 bg-[#1c1c22] border border-white/[0.1] rounded-lg shadow-xl p-1 min-w-[200px]"
                >
                  <button
                    type="button"
                    onClick={() => void handleCopyLink(entry.id)}
                    className="text-[12px] text-foreground/70 hover:bg-white/[0.06] px-3 py-1.5 rounded-md cursor-pointer flex items-center gap-2 w-full"
                  >
                    <Link2 className="size-3" />
                    Copy link to comment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResolvedIds((prev) => new Set([...prev, entry.id]));
                      setOpenMenuId(null);
                    }}
                    className="text-[12px] text-foreground/70 hover:bg-white/[0.06] px-3 py-1.5 rounded-md cursor-pointer flex items-center gap-2 w-full"
                  >
                    <Check className="size-3" />
                    Resolve thread
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CommentBox({
  taskId,
  currentUserId,
  agentNames,
  allTasks = [],
}: {
  taskId: string;
  currentUserId: string;
  agentNames: Record<string, string>;
  allTasks?: {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    mission: string | null;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isEmpty, setIsEmpty] = useState(true);
  const editorRef = useRef<CommentEditorHandle>(null);

  const mentionItems: MentionItem[] = [
    ...Object.entries(agentNames).map(([id, label]) => ({ id, label, type: "agent" as const })),
    ...allTasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({
        id: t.id,
        label: t.title,
        type: "task" as const,
        status: t.status || "backlog",
        priority: t.priority || "medium",
        mission: t.mission || "",
      })),
  ];

  function handleSubmit(html: string) {
    const stripped = html.replace(/<[^>]+>/g, "").trim();
    if (!stripped) return;
    startTransition(async () => {
      try {
        await appendTaskLog(taskId, html, "human", currentUserId);
        editorRef.current?.clear();
        toast.success("Comment added.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add comment");
      }
    });
  }

  return (
    <div className="mt-5" data-testid="task-comment-input">
      <div
        className="rounded-xl border border-border bg-white/[0.025] overflow-hidden focus-within:border-white/[0.15] transition-colors duration-150"
        data-testid="task-comment-body"
      >
        <div className="px-3 pt-3 pb-1">
          <CommentEditor
            ref={editorRef}
            mentionItems={mentionItems}
            onSubmit={handleSubmit}
            onIsEmpty={setIsEmpty}
            disabled={pending}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-3 pb-3 pt-1.5">
          <button
            type="button"
            title="Attach file (coming soon)"
            className="flex items-center justify-center size-6 rounded text-muted-foreground/20 hover:text-foreground/45 hover:bg-white/[0.05] transition-colors"
          >
            <Paperclip className="size-3.5" />
          </button>
          <button
            type="button"
            data-testid="task-comment-submit"
            disabled={pending || isEmpty}
            onClick={() => editorRef.current?.submit()}
            title="Send (⌘↵)"
            className={cn(
              "flex items-center justify-center size-7 rounded-full transition-all duration-200",
              !isEmpty && !pending
                ? "bg-primary text-black shadow-lg shadow-primary/20 hover:brightness-110"
                : "bg-white/[0.06] text-muted-foreground/30 cursor-default",
            )}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
