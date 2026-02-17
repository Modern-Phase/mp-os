import * as React from "react";

import { cn } from "@/utils/misc";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = "vertical", children, ...props }, ref) => {
    const overflowClass = {
      vertical: "overflow-y-auto",
      horizontal: "overflow-x-auto",
      both: "overflow-auto",
    }[orientation];

    return (
      <div
        ref={ref}
        className={cn(
          "relative",
          overflowClass,
          "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
