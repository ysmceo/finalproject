import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-brand text-white shadow-[0_16px_32px_hsl(var(--brand)_/_0.28)] hover:bg-brand-deep",
        secondary: "bg-night text-white shadow-[0_16px_32px_hsl(var(--night)_/_0.2)] hover:bg-night/90",
        outline: "border border-line bg-panel/88 text-ink shadow-[0_10px_24px_hsl(var(--night)_/_0.08)] backdrop-blur-sm hover:bg-panel-strong/70",
        contrast: "border border-white/16 bg-white/10 text-white shadow-[0_14px_30px_rgba(15,23,42,0.24)] backdrop-blur-sm hover:bg-white/16",
        ghost: "text-ink hover:bg-panel-strong/45",
        destructive: "bg-destructive text-white shadow-[0_16px_32px_hsl(var(--danger)_/_0.22)] hover:bg-destructive/90"
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
