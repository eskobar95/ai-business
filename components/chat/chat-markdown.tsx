"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const markdownBaseClass =
  "max-w-none text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

const headingClass = "font-semibold tracking-tight text-foreground";

export function ChatMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn(markdownBaseClass, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={cn(headingClass, "mt-4 mb-2 text-xl")}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn(headingClass, "mt-3 mb-2 text-lg")}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn(headingClass, "mt-3 mb-1.5 text-base")}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/90 mt-2 mb-2 leading-relaxed first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-foreground/85 italic">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground/90 leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /\blanguage-/.test(className ?? "");
            if (isBlock) {
              return (
                <code
                  className={cn(
                    "block font-mono text-[0.8125rem] leading-relaxed text-foreground",
                    className,
                  )}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-muted/50 border-border/60 rounded px-1 py-0.5 font-mono text-[0.85em] text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            let language = "";
            try {
              const only = Children.only(children) as ReactNode;
              if (isValidElement(only) && only.props && typeof only.props === "object") {
                const props = only.props as { className?: string };
                const m = /language-(\w+)/.exec(props.className ?? "");
                language = m?.[1] ?? "";
              }
            } catch {
              /* single child not guaranteed */
            }
            return (
              <div className="relative my-3">
                {language ? (
                  <span className="text-muted-foreground absolute top-2 right-3 z-[1] rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide backdrop-blur-sm">
                    {language}
                  </span>
                ) : null}
                <pre className="border-border/60 bg-muted/40 overflow-x-auto rounded-lg border p-3 pt-8 text-sm">
                  {children}
                </pre>
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
