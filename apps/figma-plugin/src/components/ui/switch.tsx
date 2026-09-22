import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import type { ComponentProps } from "react"

import { cn } from "../../lib/utils"

type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root>

// Shared shadcn-style switch built on the installed Base UI primitive.
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "group/switch inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-[#bfbfbf] p-0.5 outline-none transition-colors",
        "data-checked:bg-[var(--nexus-green)] focus-visible:ring-3 focus-visible:ring-[var(--nexus-green)]/25 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}
