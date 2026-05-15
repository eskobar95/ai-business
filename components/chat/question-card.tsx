"use client";

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
}: {
  questions: QuestionSpec[];
  onAnswer: (id: string, answer: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredIds = useMemo(() => new Set(Object.keys(answers)), [answers]);

  return (
    <div className="mt-3 space-y-4">
      {questions.map((q) => {
        const answered = answeredIds.has(q.id);
        const value = answers[q.id];

        return (
          <div
            key={q.id}
            className={cn(
              "border-border/60 bg-muted/15 rounded-xl border p-4",
              answered && "border-primary/25 ring-1 ring-primary/15",
            )}
          >
            <p className="text-foreground text-sm font-medium leading-snug">{q.text}</p>

            {!answered ? (
              <div className="mt-3">
                {q.options && q.options.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={cn(
                          "bg-background/70 text-foreground border-border/70 hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
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
                      className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full min-w-0 flex-1 rounded-lg border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                      placeholder="Type your answer"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Submit
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                <span className="font-medium text-foreground/80">Answer:</span>{" "}
                {value}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
