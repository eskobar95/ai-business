"use client";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  type ConfirmationProps,
} from "@/components/ai-elements/confirmation";

type ToolUIPartApproval = NonNullable<
  React.ComponentProps<typeof Confirmation>["approval"]
>;
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ai-elements/plan";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { ToolUIPart } from "ai";
import type React from "react";
import { CheckIcon, XIcon } from "lucide-react";

import type { ChatFeatures } from "@/lib/chat/chat-config";
import type { ChatToolCall } from "@/lib/chat/chat-message-types";
import type { ChatMessage } from "@/hooks/use-chat-stream";

type ToolState = ToolUIPart["state"] | "approval-requested" | "approval-responded" | "output-denied";

export function ChatMessageBlocks({
  message,
  features,
  onToolApproval,
}: {
  message: ChatMessage;
  features: ChatFeatures;
  onToolApproval?: (toolId: string, approvalId: string, approved: boolean) => void;
}) {
  if (message.role !== "assistant") return null;

  return (
    <>
      {features.sources && message.sources && message.sources.length > 0 && (
        <Sources className="mb-2">
          <SourcesTrigger count={message.sources.length} />
          <SourcesContent>
            {message.sources.map((s) => (
              <Source key={s.href} href={s.href} title={s.title} />
            ))}
          </SourcesContent>
        </Sources>
      )}

      {features.plan && message.plan && (
        <Plan className="mb-2" isStreaming={message.plan.isStreaming} defaultOpen>
          <PlanHeader>
            <div>
              <PlanTitle>{message.plan.title}</PlanTitle>
              {message.plan.description && (
                <PlanDescription>{message.plan.description}</PlanDescription>
              )}
            </div>
            <PlanAction>
              <PlanTrigger />
            </PlanAction>
          </PlanHeader>
          <PlanContent>
            {message.plan.steps?.map((step) => (
              <Task key={step.title} defaultOpen={false}>
                <TaskTrigger title={step.title} />
                <TaskContent>
                  {step.items?.map((item) => (
                    <TaskItem key={item}>{item}</TaskItem>
                  ))}
                </TaskContent>
              </Task>
            ))}
          </PlanContent>
        </Plan>
      )}

      {features.tasks && message.tasks && message.tasks.length > 0 && (
        <div className="mb-2 space-y-1">
          {message.tasks.map((t) => (
            <Task key={t.id} defaultOpen={t.status === "in_progress"}>
              <TaskTrigger title={t.title} />
              <TaskContent>
                {t.items?.map((item) => (
                  <TaskItem key={item}>{item}</TaskItem>
                ))}
              </TaskContent>
            </Task>
          ))}
        </div>
      )}

      {features.tools &&
        message.toolCalls?.map((tool) => (
          <div key={tool.id} className="mb-2 space-y-2">
            <Tool defaultOpen={tool.state === "output-available" || tool.state === "output-error"}>
              <ToolHeader state={tool.state} title={tool.name} type="dynamic-tool" toolName={tool.name} />
              <ToolContent>
                {tool.input !== undefined && <ToolInput input={tool.input} />}
                <ToolOutput
                  output={
                    tool.result ? (
                      <MessageResponse>{tool.result}</MessageResponse>
                    ) : undefined
                  }
                  errorText={tool.errorText}
                />
              </ToolContent>
            </Tool>

            {features.confirmation && tool.approval && (
              <Confirmation
                approval={tool.approval as ToolUIPartApproval}
                state={tool.state as ConfirmationProps["state"]}
              >
                <ConfirmationRequest>
                  Allow <strong>{tool.name}</strong> to run?
                </ConfirmationRequest>
                <ConfirmationAccepted>
                  <CheckIcon className="size-4" />
                  <span>Approved</span>
                </ConfirmationAccepted>
                <ConfirmationRejected>
                  <XIcon className="size-4" />
                  <span>Rejected</span>
                </ConfirmationRejected>
                {(tool.state as ToolState) === "approval-requested" && onToolApproval && (
                  <ConfirmationActions>
                    <ConfirmationAction
                      variant="outline"
                      onClick={() =>
                        onToolApproval(tool.id, tool.approval!.id, false)
                      }
                    >
                      Reject
                    </ConfirmationAction>
                    <ConfirmationAction
                      variant="default"
                      onClick={() =>
                        onToolApproval(tool.id, tool.approval!.id, true)
                      }
                    >
                      Approve
                    </ConfirmationAction>
                  </ConfirmationActions>
                )}
              </Confirmation>
            )}
          </div>
        ))}
    </>
  );
}
