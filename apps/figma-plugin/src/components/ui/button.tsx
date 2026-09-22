import { cva, type VariantProps } from "class-variance-authority"
import { forwardRef } from "react"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[32px] border border-transparent text-sm font-semibold outline-none transition-all focus-visible:border-[var(--nexus-green)] focus-visible:ring-3 focus-visible:ring-[var(--nexus-green)]/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "primary",
    },
    variants: {
      size: {
        default: "h-10 px-5",
        sm: "h-8 gap-1 px-3 text-xs leading-none [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-10 p-0",
        "icon-lg": "size-10 p-0",
      },
      variant: {
        danger: "border-[var(--nexus-border)] bg-white text-[var(--nexus-error)] hover:bg-[#fff5f7]",
        ghost: "bg-transparent text-[var(--nexus-text)] hover:bg-black/5",
        icon: "bg-[var(--nexus-preview)] text-[var(--nexus-text)] hover:bg-[#dadada]",
        primary: "bg-[var(--nexus-green)] text-white hover:bg-[#00720b]",
        secondary: "border-[var(--nexus-border)] bg-white text-[var(--nexus-text)] hover:bg-[var(--nexus-muted)]",
      },
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>

// Shared shadcn-style button primitive used across the plugin UI.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, type = "button", variant, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ className, size, variant }))}
      ref={ref}
      type={type}
      {...props}
    />
  )
)

Button.displayName = "Button"

export { buttonVariants }
