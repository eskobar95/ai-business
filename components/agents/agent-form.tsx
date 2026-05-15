"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { AgentWithInstructions } from "@/lib/agents/actions";
import { createAgent, deleteAgent, updateAgent } from "@/lib/agents/actions";
import type { agents } from "@/db/schema";

import { MarkdownEditorField } from "./markdown-editor-field";

type Peer = Pick<typeof agents.$inferSelect, "id" | "name" | "isPlatformDefault">;

type Props =
  | {
      mode: "create";
      businessId: string;
      peerAgents: Peer[];
    }
  | {
      mode: "edit";
      businessId: string;
      agent: AgentWithInstructions;
      peerAgents: Peer[];
      /** When false, soul/tools/heartbeat are edited elsewhere (e.g. DocumentEditor). */
      showInstructions?: boolean;
      children?: ReactNode;
    };

export function AgentForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial =
    props.mode === "edit"
      ? props.agent
      : {
          name: "",
          role: "",
          instructions: "",
          reportsToAgentId: null as string | null,
        };

  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [reportsToAgentId, setReportsToAgentId] = useState<string | null>(
    props.mode === "edit" ? props.agent.reportsToAgentId : null,
  );

  const showInstructions = props.mode === "edit" ? (props.showInstructions ?? true) : true;

  const peers =
    props.mode === "edit"
      ? props.peerAgents.filter((p) => p.id !== props.agent.id && !p.isPlatformDefault)
      : props.peerAgents.filter((p) => !p.isPlatformDefault);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        if (props.mode === "create") {
          const created = await createAgent({
            businessId: props.businessId,
            name,
            role,
            instructions,
            reportsToAgentId: reportsToAgentId || null,
          });
          toast.success("Agent created.");
          router.push(
            `/dashboard/agents/${created.id}?businessId=${encodeURIComponent(props.businessId)}`,
          );
          router.refresh();
          return;
        }
        await updateAgent(props.agent.id, {
          name,
          role,
          ...(showInstructions ? { instructions } : {}),
          reportsToAgentId: reportsToAgentId || null,
        });
        toast.success("Agent saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function remove() {
    if (props.mode !== "edit") return;
    if (!window.confirm("Delete this agent? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAgent(props.agent.id);
        router.push(`/dashboard/agents?businessId=${encodeURIComponent(props.businessId)}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="agent-name">
          Name
        </label>
        <input
          id="agent-name"
          data-testid="agent-name"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="agent-role">
          Role
        </label>
        <input
          id="agent-role"
          data-testid="agent-role"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      {showInstructions ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Instructions</span>
          <MarkdownEditorField
            value={instructions}
            onChange={setInstructions}
            data-testid="agent-instructions-editor"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="agent-reports-to">
          Reports to
        </label>
        <select
          id="agent-reports-to"
          data-testid="agent-reports-to"
          className="border-border bg-background rounded-md border px-3 py-2 text-sm"
          value={reportsToAgentId ?? ""}
          onChange={(e) =>
            setReportsToAgentId(e.target.value.length ? e.target.value : null)
          }
        >
          <option value="">— None —</option>
          {peers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" data-testid="agent-save" disabled={pending} onClick={submit}>
          {props.mode === "create" ? "Create agent" : "Save changes"}
        </Button>
        {props.mode === "edit" && !props.agent.isPlatformDefault ? (
          <Button
            type="button"
            variant="destructive"
            data-testid="agent-delete"
            disabled={pending}
            onClick={remove}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {props.mode === "edit" && props.children ? (
        <div className="flex flex-col gap-8">{props.children}</div>
      ) : null}
    </div>
  );
}
