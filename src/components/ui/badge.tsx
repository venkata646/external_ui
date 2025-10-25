import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary/20 text-primary backdrop-blur-sm shadow-[0_0_10px_hsl(var(--primary)/0.3)]",
        secondary: "border-secondary/50 bg-secondary/20 text-secondary backdrop-blur-sm shadow-[0_0_10px_hsl(var(--secondary)/0.3)]",
        destructive: "border-destructive/50 bg-destructive/20 text-destructive backdrop-blur-sm shadow-[0_0_10px_hsl(var(--destructive)/0.3)]",
        outline: "border-primary/50 text-foreground backdrop-blur-sm hover:bg-primary/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
