import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-extrabold tracking-[-0.01em] whitespace-nowrap transition-[background,transform,border-color,filter] duration-150 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-rosso text-white hover:bg-rosso-scuro hover:-translate-y-px active:translate-y-0",
        arancio: "bg-arancio text-white hover:brightness-95",
        ghost: "border-2 border-inchiostro bg-transparent hover:bg-inchiostro/[0.06]",
        scuro: "bg-inchiostro text-crema hover:bg-[#3a3430]",
        link: "text-rosso underline underline-offset-2 hover:text-rosso-scuro",
      },
      size: {
        default: "px-5 py-3 text-sm",
        sm: "px-4 py-2.5 text-[13px]",
        lg: "px-6 py-3.5 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
