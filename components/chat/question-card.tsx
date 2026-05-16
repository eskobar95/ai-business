"use client";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type QuestionSpec = {
  id: string;
  text: string;
  options?: string[];
};

export function QuestionCard({
  questions,
  onAnswer,
  useSuggestions = true,
}: {
  questions: QuestionSpec[];
  onAnswer: (id: string, answer: string) => void;
  /** When true, option lists use AI Elements Suggestion chips */
  useSuggestions?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredIds = useMemo(() => new Set(Object.keys(answers)), [answers]);

  return (
    <div className="mt-3 space-y-4">
      {questions.map((q) => {
        const answered = answeredIds.has(q.id);
        const value = answers[q.id];
        const hasOptions = Boolean(q.options && q.options.length > 0);

        return (
          <div
            key={q.id}
            className={cn(
              "rounded-xl border border-white/[0.06] bg-white/[0.02] p-3",
              answered && "border-primary/20 ring-1 ring-primary/10",
            )}
          >
            <p className="text-sm font-medium leading-snug text-foreground/90">{q.text}</p>

            {!answered ? (
              <div className="mt-3">
                {hasOptions && useSuggestions ? (
                  <Suggestions className="flex-wrap gap-2">
                    {q.options!.map((opt) => (
                      <Suggestion
                        key={opt}
                        suggestion={opt}
                        className="border-white/[0.08] bg-white/[0.04] text-foreground/80 hover:border-primary/30 hover:bg-primary/10"
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                          onAnswer(q.id, opt);
                        }}
                      />
                    ))}
                  </Suggestions>
                ) : hasOptions ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options!.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={cn(
                          "rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm",
                          "text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/10",
                        )}
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                          onAnswer(q.id, opt);
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const text = String(fd.get("answer") ?? "").trim();
                      if (!text) return;
                      setAnswers((prev) => ({ ...prev, [q.id]: text }));
                      onAnswer(q.id, text);
                    }}
                  >
                    <input
                      name="answer"
                      className="h-10 w-full min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      placeholder="Type your answer"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Submit
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/70">Answer:</span> {value}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
