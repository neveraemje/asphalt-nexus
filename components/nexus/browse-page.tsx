"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Layers, SearchX } from "lucide-react"

import { CategoryChips } from "@/components/nexus/category-chips"
import { ProductTabs } from "@/components/nexus/product-tabs"
import { ScreenCard } from "@/components/nexus/screen-card"
import { Button } from "@/components/ui/button"
import { platforms, screenCards } from "@/lib/nexus-data"

function BrowsePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentApp = (searchParams.get("app") || "consumer") as "consumer" | "merchant" | "driver"
  const activeApp = ["consumer", "merchant", "driver"].includes(currentApp) ? currentApp : "consumer"
  const activeCategory = searchParams.get("category") || "All"
  const searchQuery = (searchParams.get("q") || "").toLowerCase().trim()

  const currentPlatformInfo = React.useMemo(() => {
    return platforms.find((p) => p.slug === activeApp) || platforms[0]
  }, [activeApp])

  const filteredScreens = React.useMemo(() => {
    return screenCards.filter((screen) => {
      // Filter by App
      if (screen.app !== activeApp) return false

      // Filter by Category
      if (activeCategory !== "All" && screen.category !== activeCategory) {
        return false
      }

      // Filter by Search Query
      if (searchQuery) {
        const matchesTitle = screen.title.toLowerCase().includes(searchQuery)
        const matchesCategory = screen.category.toLowerCase().includes(searchQuery)
        const matchesPlatform = screen.platform.toLowerCase().includes(searchQuery)
        return matchesTitle || matchesCategory || matchesPlatform
      }

      return true
    })
  }, [activeApp, activeCategory, searchQuery])

  return (
    <main className="min-h-screen pb-20">
      <h1 className="sr-only">
        {currentPlatformInfo.name} Screen Library - Asphalt Nexus
      </h1>

      {/* Product App Navigation Tabs */}
      {/* <ProductTabs /> */}

      {/* Category Pills */}
      <CategoryChips />

      {/* Screen Cards Grid */}
      <section
        aria-label={`${currentPlatformInfo.name} Screens`}
        className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10"
      >
        {filteredScreens.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {filteredScreens.map((screen, index) => (
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
              No screens match {searchQuery ? `"${searchQuery}" in ` : ""}
              {activeCategory !== "All" ? `category "${activeCategory}"` : currentPlatformInfo.name}.
            </p>
            <Button
              className="mt-6 rounded-full bg-[#008a0d] hover:bg-[#00720b]"
              onClick={() => {
                router.push(`/?app=${activeApp}`)
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
