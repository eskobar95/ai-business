"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SprintBriefMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
