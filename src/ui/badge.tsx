import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/utils/misc";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-sm",
        outline: "border border-input text-foreground",
        success:
          "bg-green-500/10 text-green-600 border border-green-500/20 dark:text-green-400",
        warning:
          "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400",
        info: "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400",
        gradient: "bg-gradient-primary text-white shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
