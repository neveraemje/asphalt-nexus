import { cn } from "../../lib/utils"

// Shared shadcn-style input primitive with the plugin's focus and border styling.
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full min-w-0 rounded-[12px] border border-[var(--nexus-border)] bg-[var(--nexus-muted)] px-4 text-sm text-[var(--nexus-text)] outline-none transition placeholder:text-[var(--nexus-inactive)] focus:border-[var(--nexus-green)] focus:bg-white focus:ring-3 focus:ring-[var(--nexus-green)]/20",
        className
      )}
      {...props}
    />
  )
}
