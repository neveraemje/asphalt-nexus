"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { useNexusData } from "@/components/nexus/nexus-data-provider"
import { appTabs, getActiveAppFromParams } from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

function ProductTabsContent() {
  const searchParams = useSearchParams()
  const { screenCards } = useNexusData()

  const activeSlug = React.useMemo(
    () => screenCards.find((screen) => screen.id === searchParams.get("id"))?.app
      || getActiveAppFromParams(searchParams),
    [screenCards, searchParams]
  )

  return (
    <nav
      aria-label="Product navigation"
      className="mx-auto flex w-full max-w-[1440px] gap-8 overflow-x-auto px-5 pt-6 sm:px-8 lg:gap-[33px] lg:px-10"
    >
      {appTabs.map((platform) => {
        const isActive = activeSlug === platform.slug
        return (
          <Link
            className={cn(
              "relative shrink-0 pb-[15px] text-[22px] font-semibold leading-[29px] text-[#8b8b8b] transition-colors hover:text-black sm:text-2xl",
                isActive && "rounded-full bg-[#008a0d] text-white"
            )}
            href={platform.href}
            key={platform.name}
          >
            {platform.name}
          </Link>
        )
      })}
    </nav>
  )
}

export function ProductTabs() {
  return (
    <React.Suspense
      fallback={
        <nav
          aria-label="Product navigation"
          className="mx-auto flex w-full max-w-[1440px] gap-8 overflow-x-auto px-5 pt-6 sm:px-8 lg:gap-[33px] lg:px-10"
        >
          {appTabs.map((platform, index) => (
            <div
              key={platform.name}
              className={cn(
                "relative shrink-0 rounded-full px-4 pb-[15px] pt-1 text-[22px] font-semibold leading-[29px] text-[#8b8b8b] sm:text-2xl",
                index === 0 && "bg-[#008a0d] text-white"
              )}
            >
              {platform.name}
            </div>
          ))}
        </nav>
      }
    >
      <ProductTabsContent />
    </React.Suspense>
  )
}
