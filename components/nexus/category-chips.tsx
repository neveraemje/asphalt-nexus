"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useNexusData } from "@/components/nexus/nexus-data-provider"
import { cn } from "@/lib/utils"
import { getActiveAppFromParams } from "@/lib/nexus-data"

function CategoryChipsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { screenCards } = useNexusData()

  const activeApp = getActiveAppFromParams(searchParams)
  const rawCategory = searchParams.get("category")
  const currentCategory = !rawCategory || rawCategory === "All" ? "All Teams" : rawCategory

  const availableCategories = React.useMemo(() => {
    const list = Array.from(new Set(
      screenCards
        .filter((screen) => activeApp === "all" || screen.app === activeApp)
        .map((screen) => screen.category)
    ))
    return ["All Teams", ...list]
  }, [activeApp, screenCards])

  const handleSelect = (category: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (category === "All Teams") {
      params.delete("category")
    } else {
      params.set("category", category)
    }
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  // Count screens per category for this app
  const getCategoryCount = (category: string) => {
    if (category === "All Teams") {
      return screenCards.filter((s) => activeApp === "all" || s.app === activeApp).length
    }
    return screenCards.filter((s) => (
      (activeApp === "all" || s.app === activeApp) && s.category === category
    )).length
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 overflow-x-auto px-5 py-6 sm:px-8 lg:px-10">
      {availableCategories.map((category) => {
        const isSelected = currentCategory === category
        const count = getCategoryCount(category)

        return (
          <button
            key={category}
            onClick={() => handleSelect(category)}
            className={cn(
              "group inline-flex h-10 shrink-0 items-center gap-2 rounded-[32px] border px-4 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#008a0d]/20 active:scale-95 cursor-pointer",
              isSelected
                ? "border-[#008a0d] bg-[#e8ffea] text-[#008a0d] shadow-xs"
                : "border-[var(--nexus-border)] bg-white text-[#2b2b2b] hover:border-[#008a0d]/40 hover:bg-zinc-50"
            )}
            type="button"
          >
            <span>{category}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-bold transition-colors",
                isSelected
                  ? "bg-[#008a0d]/15 text-[#008a0d]"
                  : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200"
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function CategoryChips() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-[1440px] gap-3 overflow-x-auto px-5 py-6 sm:px-8 lg:px-10">
          <div className="h-11 w-20 animate-pulse rounded-[32px] bg-zinc-200" />
          <div className="h-11 w-28 animate-pulse rounded-[32px] bg-zinc-200" />
          <div className="h-11 w-24 animate-pulse rounded-[32px] bg-zinc-200" />
        </div>
      }
    >
      <CategoryChipsContent />
    </React.Suspense>
  )
}
