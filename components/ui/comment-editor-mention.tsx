"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ReactRenderer,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { cn } from "@/lib/utils";

export type MentionItem = {
  id: string;
  label: string;
  type: "agent" | "task";
  status?: string;
  priority?: string;
  /** Display label for task free-text mission field */
  mission?: string;
};

type MentionListProps = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
};

type MentionListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const MentionList = forwardRef<MentionListHandle, MentionListProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]!);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  const agents = items.filter((i) => i.type === "agent");
  const tasks = items.filter((i) => i.type === "task");

  const flatItems = [...agents, ...tasks];

  function renderItem(item: MentionItem, globalIdx: number) {
    const active = globalIdx === selected;
    return (
      <button
        key={item.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          command(item);
        }}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          active ? "bg-white/[0.08] text-foreground" : "text-foreground/60 hover:bg-white/[0.05]",
        )}
      >
        {item.type === "agent" ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-mono text-[9px] font-semibold text-foreground/50">
            {item.label.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-amber-500/[0.12] font-mono text-[9px] text-amber-400/80">
            #
          </span>
        )}
        <span className="truncate text-[12.5px] leading-none">{item.label}</span>
        {item.type === "agent" && (
          <span className="ml-auto shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/35">
            Agent
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="slash-menu z-50 w-[240px] overflow-hidden rounded-lg border border-white/[0.10] bg-[#191919] shadow-2xl shadow-black/70 py-1">
      {agents.length > 0 && (
        <>
          <p className="px-3 pt-1.5 pb-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/30">
            Agents
          </p>
          {agents.map((item) => renderItem(item, flatItems.indexOf(item)))}
        </>
      )}
      {tasks.length > 0 && (
        <>
          <p
            className={cn(
              "px-3 pb-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/30",
              agents.length > 0 && "pt-2 border-t border-white/[0.05] mt-1",
            )}
          >
            Issues
          </p>
          {tasks.map((item) => renderItem(item, flatItems.indexOf(item)))}
        </>
      )}
    </div>
  );
});
MentionList.displayName = "MentionList";

function statusDotColor(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("progress") || s.includes("active")) return "bg-blue-400";
  if (s.includes("done") || s.includes("complete")) return "bg-emerald-400";
  if (s.includes("cancel") || s.includes("block")) return "bg-red-400";
  if (s.includes("review")) return "bg-amber-400";
  if (s.includes("backlog") || s.includes("todo")) return "bg-white/30";
  return "bg-white/25";
}

function MentionChip({ node }: NodeViewProps) {
  const { id, label, type, meta } = node.attrs as {
    id: string;
    label: string;
    type: "agent" | "task" | null;
    meta?: string;
  };

  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  const isAgent = !type || type === "agent";
  const monogram = (label ?? "?").slice(0, 1).toUpperCase();

  const metaObj: Record<string, string> = (() => {
    if (!meta) return {};
    try {
      return JSON.parse(meta) as Record<string, string>;
    } catch {
      return {};
    }
  })();

  function handleMouseEnter() {
    if (!chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    const above = rect.top >= 140;
    if (above) {
      setCoords({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
    } else {
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
    setHovered(true);
  }

  function handleMouseLeave() {
    hideTimeout.current = setTimeout(() => setHovered(false), 150);
  }

  function handleTooltipMouseEnter() {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }

  function handleTooltipMouseLeave() {
    setHovered(false);
  }

  const agentTooltip = (
    <div className="bg-[#16161a] border border-white/[0.1] rounded-xl shadow-2xl p-3 w-[160px] flex flex-col items-start">
      <span className="size-8 rounded-lg bg-violet-500/20 border border-violet-500/15 flex items-center justify-center font-mono text-[13px] font-bold text-violet-300 shrink-0">
        {monogram}
      </span>
      <p className="text-[13px] font-semibold text-foreground/90 mt-2 leading-tight w-full truncate">{label}</p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-white/[0.06] text-muted-foreground/60 border border-border">
          Agent
        </span>
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-white/[0.06] text-muted-foreground/60 border border-border font-mono">
          #{(metaObj.id ?? id).slice(0, 6)}
        </span>
      </div>
    </div>
  );

  const issueId = metaObj.id ?? id;
  const issueTitle = metaObj.label ?? label;
  const issueStatus = metaObj.status ?? "";
  const issueMission =
    (typeof metaObj.mission === "string" && metaObj.mission) ||
    (typeof metaObj.project === "string" && metaObj.project) ||
    "";
  const issuePriority = metaObj.priority ?? "";
  const issueAssignee = metaObj.assignee ?? "";
  const assigneeMonogram = issueAssignee
    ? issueAssignee.slice(0, 2).toUpperCase()
    : (issueTitle ?? "?").slice(0, 1).toUpperCase();

  const issueTooltip = (
    <div className="bg-[#16161a] border border-white/[0.1] rounded-xl shadow-2xl p-3 w-[260px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground/60 truncate max-w-[170px]">
          #{issueId.length <= 12 ? issueId : issueId.slice(0, 8)}
        </span>
        <span className="size-5 rounded-full bg-violet-500/30 text-violet-300 text-[9px] font-bold flex items-center justify-center shrink-0 ml-1">
          {assigneeMonogram}
        </span>
      </div>
      <p className="text-[12px] font-medium text-foreground/90 mt-1 leading-snug line-clamp-2">{issueTitle}</p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {issueStatus ? (
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full shrink-0", statusDotColor(issueStatus))} />
            <span className="text-[10px] text-muted-foreground/70">{issueStatus}</span>
          </span>
        ) : null}
        {issueMission ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span>⬡</span>
            <span>{issueMission}</span>
          </span>
        ) : null}
        {issuePriority ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span>▪</span>
            <span>{issuePriority}</span>
          </span>
        ) : null}
      </div>
    </div>
  );

  const truncName = label ? (label.length > 15 ? label.slice(0, 15) + "…" : label) : "?";
  const truncTitle = label ? (label.length > 20 ? label.slice(0, 20) + "…" : label) : "?";

  return (
    <NodeViewWrapper as={"span" as unknown as "div"} style={{ display: "inline" }}>
      <span
        ref={chipRef}
        contentEditable={false}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1 py-0 text-[11px] font-medium cursor-default select-none align-middle",
          isAgent
            ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
            : "bg-white/[0.07] text-foreground/80 border border-white/[0.12]",
        )}
      >
        {isAgent ? (
          <>
            <span className="size-3.5 rounded-full bg-violet-500/20 flex items-center justify-center font-mono text-[9px] text-violet-200 shrink-0">
              {monogram}
            </span>
            <span>@{truncName}</span>
          </>
        ) : (
          <>
            <span className="size-1.5 rounded-full bg-amber-400/70 shrink-0" />
            <span className="font-mono text-[10px]">#{id.length <= 12 ? id : id.slice(0, 8)}</span>
            <span className="text-muted-foreground/40 px-0.5">·</span>
            <span>{truncTitle}</span>
          </>
        )}
      </span>
      {hovered &&
        coords &&
        createPortal(
          <div
            className="tooltip-animate fixed z-[9999]"
            style={{ top: coords.top, bottom: coords.bottom, left: coords.left }}
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            {isAgent ? agentTooltip : issueTooltip}
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
}

export function createMentionExtension(mentionItems: MentionItem[]) {
  return Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        type: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-mention-type"),
          renderHTML: (attrs) => (attrs.type ? { "data-mention-type": attrs.type as string } : {}),
        },
        meta: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-mention-meta"),
          renderHTML: (attrs) => (attrs.meta ? { "data-mention-meta": attrs.meta as string } : {}),
        },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(MentionChip);
    },
  }).configure({
    HTMLAttributes: { "data-mention": "" },
    renderHTML({ options, node }) {
      return [
        "span",
        {
          ...options.HTMLAttributes,
          "data-mention-id": node.attrs.id as string,
          "data-mention-type": (node.attrs.type ?? "") as string,
        },
        `${options.suggestion.char ?? "@"}${(node.attrs.label ?? node.attrs.id) as string}`,
      ];
    },
    suggestion: {
      items: ({ query }: { query: string }) =>
        mentionItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
      command: ({ editor, range, props }) => {
        const item = props as MentionItem;
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: "mention",
              attrs: {
                id: item.id,
                label: item.label,
                type: item.type,
                meta: JSON.stringify({
                  id: item.id,
                  label: item.label,
                  type: item.type,
                  status: item.status,
                  priority: item.priority,
                  mission: item.mission,
                  project: item.mission,
                }),
              },
            },
            { type: "text", text: " " },
          ])
          .run();
      },
      render: () => {
        let component: ReactRenderer<MentionListHandle>;
        let popup: TippyInstance[];

        return {
          onStart(props) {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });
            if (!props.clientRect) return;
            popup = tippy("body", {
              getReferenceClientRect: props.clientRect as () => DOMRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
              theme: "none",
              animation: "shift-away",
              duration: [100, 70],
            });
          },
          onUpdate(props) {
            component.updateProps(props);
            if (!props.clientRect) return;
            popup[0]?.setProps({
              getReferenceClientRect: props.clientRect as () => DOMRect,
            });
          },
          onKeyDown(props) {
            if (props.event.key === "Escape") {
              popup[0]?.hide();
              return true;
            }
            return component.ref?.onKeyDown(props) ?? false;
          },
          onExit() {
            popup[0]?.destroy();
            component.destroy();
          },
        };
      },
    },
  });
}
