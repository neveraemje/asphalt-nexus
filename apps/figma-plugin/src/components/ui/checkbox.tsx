import { Check } from "lucide-react"

import { cn } from "../../lib/utils"

type CheckboxProps = Omit<React.ComponentProps<"input">, "type">

// Shared shadcn-style checkbox primitive for selecting gallery screens.
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <span className={cn("relative inline-flex size-6 shrink-0", className)}>
      <input
        className="peer absolute inset-0 size-6 cursor-pointer appearance-none rounded-[6px] border border-[#bfbfbf] bg-white shadow-sm outline-none transition checked:border-[var(--nexus-green)] checked:bg-[var(--nexus-green)] focus-visible:ring-3 focus-visible:ring-[var(--nexus-green)]/25"
        type="checkbox"
        {...props}
      />
      <Check className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition peer-checked:opacity-100" />
    </span>
  )
}
