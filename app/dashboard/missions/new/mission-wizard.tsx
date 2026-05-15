"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createMission } from "@/lib/missions/actions";

type ProjectType = "new_project" | "existing_codebase" | "feature" | "bugfix";

const PROJECT_TYPE_OPTIONS: { id: ProjectType; label: string; description: string }[] = [
  { id: "new_project", label: "New project", description: "Build from scratch" },
  { id: "existing_codebase", label: "Existing codebase", description: "Work on an existing repo" },
  { id: "feature", label: "New feature", description: "Add a feature to a product" },
  { id: "bugfix", label: "Bug fix / improvement", description: "Fix a bug or improve existing code" },
];

const TOTAL_STEPS = 4;

interface MissionWizardProps {
  businessId: string;
  soulContent?: string | null;
}

export function MissionWizard({ businessId, soulContent }: MissionWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, start] = useTransition();

  // Step 1
  const [projectType, setProjectType] = useState<ProjectType>("new_project");
  const [name, setName] = useState("");

  // Step 2
  const [goal, setGoal] = useState("");

  // Step 3
  const [criteria, setCriteria] = useState<string[]>([]);
  const [criterionInput, setCriterionInput] = useState("");
  const criterionRef = useRef<HTMLInputElement>(null);

  // Derived validation
  const step1Valid = name.trim().length >= 3;
  const step2Valid = goal.trim().length >= 20;
  const step3Valid = criteria.length >= 1;

  function addCriterion() {
    const val = criterionInput.trim();
    if (!val) return;
    setCriteria((prev) => [...prev, val]);
    setCriterionInput("");
    criterionRef.current?.focus();
  }

  function removeCriterion(idx: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleCriterionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCriterion();
    }
  }

  function handleSubmit() {
    const validationContract = criteria.map((c) => `- ${c}`).join("\n");
    start(async () => {
      try {
        const row = await createMission({
          businessId,
          name: name.trim(),
          prd: goal.trim(),
          status: "draft",
          validationContract,
          projectType,
        });
        toast.success("Mission created.");
        router.push(`/dashboard/missions/${row.id}?businessId=${encodeURIComponent(businessId)}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create mission");
      }
    });
  }

  const selectedType = PROJECT_TYPE_OPTIONS.find((o) => o.id === projectType)!;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Missions</p>
        <h1 className="text-xl font-semibold tracking-tight">New mission</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={n} className="flex items-center gap-2">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                ].join(" ")}
              >
                {done ? "✓" : n}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div
                  className={[
                    "h-px w-10 transition-colors",
                    done ? "bg-primary" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
        <span className="ml-2 text-[11px] text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card/40 p-6">
        {step === 1 && (
          <Step1
            projectType={projectType}
            onProjectTypeChange={setProjectType}
            name={name}
            onNameChange={setName}
          />
        )}
        {step === 2 && (
          <Step2
            goal={goal}
            onGoalChange={setGoal}
            soulContent={soulContent}
          />
        )}
        {step === 3 && (
          <Step3
            criteria={criteria}
            criterionInput={criterionInput}
            onCriterionInputChange={setCriterionInput}
            onAdd={addCriterion}
            onRemove={removeCriterion}
            onKeyDown={handleCriterionKeyDown}
            inputRef={criterionRef}
          />
        )}
        {step === 4 && (
          <Step4
            projectType={selectedType}
            name={name}
            goal={goal}
            criteria={criteria}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-md border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 3 && !step3Valid)
            }
            className="rounded-md bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-md bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create mission"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step sub-components ─────────────────────────────────────────────── */

function Step1({
  projectType,
  onProjectTypeChange,
  name,
  onNameChange,
}: {
  projectType: ProjectType;
  onProjectTypeChange: (t: ProjectType) => void;
  name: string;
  onNameChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-[13px] font-semibold text-foreground">What type of mission is this?</p>
        <p className="mb-4 text-[12px] text-muted-foreground">Pick the category that best describes the work.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROJECT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onProjectTypeChange(opt.id)}
              className={[
                "flex flex-col items-start gap-0.5 rounded-lg border p-4 text-left transition-colors",
                projectType === opt.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-white/[0.02] hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className="text-[13px] font-semibold text-foreground">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="section-label" htmlFor="mission-name">
          Mission name <span className="text-destructive">*</span>
        </label>
        <input
          id="mission-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Payments v2"
          className="rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none ring-ring focus-visible:ring-2"
        />
        {name.trim().length > 0 && name.trim().length < 3 && (
          <p className="text-[11px] text-destructive">At least 3 characters required.</p>
        )}
      </div>
    </div>
  );
}

function Step2({
  goal,
  onGoalChange,
  soulContent,
}: {
  goal: string;
  onGoalChange: (v: string) => void;
  soulContent?: string | null;
}) {
  const truncated = soulContent
    ? soulContent.length > 300
      ? soulContent.slice(0, 300) + "…"
      : soulContent
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label className="section-label" htmlFor="mission-goal">
          What should this mission achieve? <span className="text-destructive">*</span>
        </label>
        <p className="text-[11px] text-muted-foreground">Describe the goal in plain language. Your Product Owner will use this to generate a sprint brief.</p>
        <textarea
          id="mission-goal"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          rows={6}
          placeholder="e.g. Implement a full checkout flow with Stripe, including recurring subscriptions and a billing portal."
          className="resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none ring-ring focus-visible:ring-2"
        />
        {goal.trim().length > 0 && goal.trim().length < 20 && (
          <p className="text-[11px] text-destructive">At least 20 characters required.</p>
        )}
      </div>

      {truncated && (
        <div className="rounded-lg border border-border bg-white/[0.02] p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your business context
          </p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground/80">{truncated}</p>
        </div>
      )}
    </div>
  );
}

function Step3({
  criteria,
  criterionInput,
  onCriterionInputChange,
  onAdd,
  onRemove,
  onKeyDown,
  inputRef,
}: {
  criteria: string[];
  criterionInput: string;
  onCriterionInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-[13px] font-semibold text-foreground">What defines done?</p>
        <p className="text-[12px] text-muted-foreground">List your acceptance criteria. Each criterion becomes a measurable checkpoint.</p>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={criterionInput}
          onChange={(e) => onCriterionInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. User can complete checkout without errors"
          className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none ring-ring focus-visible:ring-2"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!criterionInput.trim()}
          className="rounded-md border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {criteria.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/60">No criteria yet. Add at least one to continue.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {criteria.map((c, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-white/[0.02] px-3 py-2"
            >
              <span className="flex-1 text-[13px] text-foreground">{c}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="mt-0.5 shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Remove criterion"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Step4({
  projectType,
  name,
  goal,
  criteria,
}: {
  projectType: { id: ProjectType; label: string; description: string };
  name: string;
  goal: string;
  criteria: string[];
}) {
  const goalPreview = goal.trim().slice(0, 150) + (goal.trim().length > 150 ? "…" : "");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-[13px] font-semibold text-foreground">Review your mission</p>
        <p className="text-[12px] text-muted-foreground">Confirm the details below before creating.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-white/[0.02] p-4">
        <ReviewRow label="Type">
          <span className="rounded-full border border-border bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-foreground">
            {projectType.label}
          </span>
        </ReviewRow>

        <ReviewRow label="Name">
          <span className="text-[13px] font-semibold text-foreground">{name}</span>
        </ReviewRow>

        <ReviewRow label="Goal">
          <span className="text-[12px] leading-relaxed text-muted-foreground">{goalPreview}</span>
        </ReviewRow>

        <ReviewRow label="Criteria">
          <span className="text-[13px] font-semibold text-foreground">
            {criteria.length} acceptance {criteria.length === 1 ? "criterion" : "criteria"}
          </span>
        </ReviewRow>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}
