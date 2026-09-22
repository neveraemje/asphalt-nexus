"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SearchX } from "lucide-react"

import { CategoryChips } from "@/components/nexus/category-chips"
import { useNexusData } from "@/components/nexus/nexus-data-provider"
import { SearchScreenCard } from "@/components/nexus/search-screen-card"
import { ScreenCard } from "@/components/nexus/screen-card"
import { Button } from "@/components/ui/button"
import {
  getActiveAppFromParams,
  platforms,
  getScreenSearchText,
} from "@/lib/nexus-data"

function BrowsePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { error, loading, records, screenCards } = useNexusData()

  const activeApp = getActiveAppFromParams(searchParams)
  const rawCategory = searchParams.get("category")
  const activeCategory = !rawCategory || rawCategory === "All" ? "All Teams" : rawCategory
  const searchQuery = (searchParams.get("q") || "").toLowerCase().trim()

  const currentPlatformInfo = React.useMemo(() => {
    return activeApp === "all"
      ? { name: "All Apps", description: "All Gojek application screens." }
      : platforms.find((p) => p.slug === activeApp) || platforms[0]
  }, [activeApp])

  const filteredScreens = React.useMemo(() => {
    return screenCards.filter((screen) => {
      if (activeApp !== "all" && screen.app !== activeApp) return false
      if (activeCategory !== "All Teams" && screen.category !== activeCategory) {
        return false
      }

      return true
    })
  }, [activeApp, activeCategory, screenCards])

  const searchResults = React.useMemo(() => {
    if (!searchQuery) return []
    return records.filter((record) => getScreenSearchText(record).includes(searchQuery))
  }, [records, searchQuery])

  return (
    <main className="min-h-screen pb-20">
      <h1 className="sr-only">
        {currentPlatformInfo.name} Screen Library - Asphalt Nexus
      </h1>

      {/* Product App Navigation Tabs */}
      {/* <ProductTabs /> */}

      {/* Category Pills */}
      {!searchQuery ? <CategoryChips /> : null}

      {/* Screen Cards Grid */}
      <section
        aria-label={`${currentPlatformInfo.name} Screens`}
        className={searchQuery ? "w-full" : "mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10"}
      >
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="h-[460px] animate-pulse rounded-[24px] bg-zinc-200" key={index} />
            ))}
          </div>
        ) : (searchQuery ? searchResults.length > 0 : filteredScreens.length > 0) ? (
          <div className={searchQuery
            ? "mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-5 pb-16 pt-8 min-[560px]:grid-cols-2 sm:px-8 md:grid-cols-3 lg:grid-cols-5 lg:px-10"
            : "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"}
          >
            {searchQuery
              ? searchResults.map((record, index) => (
                <SearchScreenCard
                  key={record.id}
                  priority={index < 3}
                  record={record}
                />
              ))
              : filteredScreens.map((screen, index) => (
                <ScreenCard
                  key={screen.id}
                  priority={index < 3}
                  screen={screen}
                />
              ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/50 px-6 py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <SearchX className="size-7" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-zinc-900">
              No screens found
            </h2>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              {error || (
                searchQuery
                  ? <>No screens match &quot;{searchQuery}&quot; across all apps.</>
                  : <>No screens match {activeCategory !== "All Teams" ? `category "${activeCategory}"` : currentPlatformInfo.name}.</>
              )}
            </p>
            <Button
              className="mt-6 rounded-full bg-[#008a0d] hover:bg-[#00720b]"
              onClick={() => {
                router.push(activeApp === "all" ? "/" : `/?app=${activeApp}`)
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </section>
    </main>
  )
}

export function BrowsePage() {
  return (
    <React.Suspense
      fallback={
        <main className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-10">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-200" />
          <div className="mt-6 flex gap-4">
            <div className="h-10 w-24 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-10 w-24 animate-pulse rounded-full bg-zinc-200" />
          </div>
        </main>
      }
    >
      <BrowsePageContent />
    </React.Suspense>
  )
}
