import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-[background-color,border-color,color,box-shadow,opacity] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent-solid text-text-on-accent shadow-sm hover:bg-accent-solid-hover",
        destructive: "bg-error text-text-on-accent shadow-sm hover:bg-error/90",
        /* `border-solid` is required, not decorative: App.css's `button { border: none }`
           scores 0,0,1 and beats Tailwind preflight's `* { border-style: solid }`
           (0,0,0), so a bordered <button> renders with no visible border unless a
           border-style utility (0,1,0) overrides it. */
        outline: "border border-solid border-border-strong bg-surface text-text-primary shadow-sm hover:border-primary/45 hover:bg-hover",
        secondary: "border border-solid border-border-subtle bg-muted text-text-primary hover:bg-hover",
        ghost: "text-text-secondary hover:bg-hover hover:text-text-primary",
        link: "text-primary underline-offset-4 hover:text-primary-hover hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
