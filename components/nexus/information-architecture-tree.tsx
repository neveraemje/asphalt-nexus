import { WorkflowSquare08Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { InformationArchitectureNode } from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

type InformationArchitectureTreeProps = {
  regions: InformationArchitectureNode[]
  screenName: string
}

// Renders the saved IA as the same compact vertical tree used by the plugin editor.
export function InformationArchitectureTree({
  regions,
  screenName,
}: InformationArchitectureTreeProps) {
  return (
    <div aria-label={`${screenName} information architecture`} className="min-w-0">
      <div className="flex min-h-10 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dfe3e5] bg-[#f6f8f8] text-[#172036]">
          <HugeiconsIcon icon={WorkflowSquare08Icon} size={22} strokeWidth={1.5} />
        </span>
        <p className="min-w-0 break-words text-[15px] font-semibold leading-5 text-[#202020]">
          {screenName}
        </p>
      </div>

      {regions.length > 0 ? (
        <ol
          className="relative ml-5 mt-3 border-l border-[#dfe3e5] pb-1 before:absolute before:-top-3 before:-left-px before:h-3 before:border-l before:border-[#dfe3e5]"
        >
          {regions.map((region, index) => (
            <InformationArchitectureBranch
              depth={1}
              isLast={index === regions.length - 1}
              key={`${region.label}-${index}`}
              node={region}
            />
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-[8px] bg-[#f6f8f8] px-4 py-3 text-sm text-[#777]">
          No information architecture saved.
        </p>
      )}
    </div>
  )
}

// Renders one IA branch and its nested children without editable controls.
function InformationArchitectureBranch({
  depth,
  isLast,
  node,
}: {
  depth: number
  isLast: boolean
  node: InformationArchitectureNode
}) {
  const isTopLevel = depth === 1

  return (
    <li
      className={cn("relative", !isLast && (isTopLevel ? "pb-3" : "pb-1"))}
    >
      {isLast ? (
        <span className="absolute -left-px bottom-0 top-5 z-[1] w-px bg-white" />
      ) : null}
      <span className="absolute -left-px top-0 h-5 w-6 rounded-bl-[10px] border-b border-l border-[#dfe3e5]" />
      <span className="absolute left-[21px] top-[17px] z-[2] size-1.5 rounded-full border border-[#008a0d] bg-white" />

      <div className="min-h-8 pl-8 pr-1 pt-2">
        <span className={cn(
          "block break-words leading-5 text-[#303030]",
          isTopLevel ? "text-sm font-semibold" : "text-[13px] font-medium"
        )}>
          {node.label}
        </span>
      </div>

      {node.children.length > 0 ? (
        <ol className="ml-6 border-l border-dashed border-[#dfe3e5]">
          {node.children.map((child, index) => (
            <InformationArchitectureBranch
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              key={`${child.label}-${index}`}
              node={child}
            />
          ))}
        </ol>
      ) : null}
    </li>
  )
}
