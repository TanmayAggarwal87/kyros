import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-border",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800/50",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800/50",
        info:
          "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-800/50",
        inferred:
          "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-800/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
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
