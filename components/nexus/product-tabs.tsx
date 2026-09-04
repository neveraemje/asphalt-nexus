"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { getActiveAppFromParams, platforms } from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

function ProductTabsContent() {
  const searchParams = useSearchParams()

  const activeSlug = React.useMemo(
    () => getActiveAppFromParams(searchParams),
    [searchParams]
  )

  return (
    <nav
      aria-label="Product navigation"
      className="mx-auto flex w-full max-w-[1440px] gap-8 overflow-x-auto px-5 pt-6 sm:px-8 lg:gap-[33px] lg:px-10"
    >
      {platforms.map((platform) => {
        const isActive = activeSlug === platform.slug
        return (
          <Link
            className={cn(
              "relative shrink-0 pb-[15px] text-[22px] font-semibold leading-[29px] text-[#8b8b8b] transition-colors hover:text-black sm:text-2xl",
              isActive &&
                "text-black after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-black"
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
          {platforms.map((platform, idx) => (
            <div
              key={platform.name}
              className={cn(
                "relative shrink-0 pb-[15px] text-[22px] font-semibold leading-[29px] text-[#8b8b8b] sm:text-2xl",
                idx === 0 &&
                  "text-black after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-black"
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
