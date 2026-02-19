import * as React from "react";

import { cn } from "@/utils/misc";

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "circular" | "text" | "card";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default: "rounded-lg",
    circular: "rounded-full",
    text: "rounded h-4",
    card: "rounded-xl",
  };

  return (
    <div
      ref={ref}
      className={cn("shimmer", variantStyles[variant], className)}
      {...props}
    />
  );
});
Skeleton.displayName = "Skeleton";

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center space-x-3">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <Skeleton variant="card" className="h-32" />
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-5/6" />
      </div>
    </div>
  );
}

function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center space-x-4 p-4 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === 0 ? "w-1/4" : i === columns - 1 ? "w-16" : "w-1/3"}
        />
      ))}
    </div>
  );
}

function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start space-x-3",
        isUser && "flex-row-reverse space-x-reverse",
      )}
    >
      <Skeleton variant="circular" className="h-8 w-8" />
      <div className="space-y-2 max-w-[70%]">
        <Skeleton
          variant="card"
          className={cn("h-16", isUser ? "bg-primary/20" : "bg-muted/50")}
        />
      </div>
    </div>
  );
}

export { Skeleton, CardSkeleton, TableRowSkeleton, ChatMessageSkeleton };
