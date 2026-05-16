import type { ReactNode } from "react";
import * as React from "react";
import { cn } from "@/lib/utils";

type CardTag = "div" | "li" | "article" | "section";

interface LegacyCardProps {
  children: ReactNode;
  className?: string;
  padding?: string;
  interactive?: boolean;
  as?: CardTag;
  size?: "default" | "sm";
}

export function Card({
  children,
  className,
  padding = "p-5",
  interactive = false,
  as: Tag = "div",
  size,
  ...rest
}: LegacyCardProps & Record<string, unknown>) {
  const isStructured = React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type === "function" &&
      ["CardHeader", "CardContent", "CardFooter"].includes(
        (child.type as { displayName?: string; name?: string }).displayName ??
          (child.type as { name?: string }).name ??
          "",
      ),
  );

  if (isStructured || size) {
    return (
      <Tag
        data-slot="card"
        data-size={size ?? "default"}
        className={cn(
          "group/card flex flex-col gap-6 overflow-hidden rounded-xl bg-card py-6 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10",
          className,
        )}
        {...rest}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      data-slot="card"
      className={cn(
        "rounded-md border border-border bg-card text-sm text-card-foreground",
        padding,
        interactive &&
          "cursor-pointer transition-all duration-150 hover:border-white/[0.14] hover:bg-white/[0.02]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-header" className={cn("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4", className)} {...props} />
  );
}
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-title" className={cn("text-base leading-normal font-medium group-data-[size=sm]/card:text-sm", className)} {...props} />
  );
}
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />
  );
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-6 group-data-[size=sm]/card:px-4", className)} {...props} />
  );
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-footer" className={cn("flex items-center rounded-b-xl px-6 group-data-[size=sm]/card:px-4 [.border-t]:pt-6 group-data-[size=sm]/card:[.border-t]:pt-4", className)} {...props} />
  );
}
export { CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
