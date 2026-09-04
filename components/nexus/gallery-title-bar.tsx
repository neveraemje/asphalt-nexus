"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { getScreenById, platforms } from "@/lib/nexus-data"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function GalleryTitleBarContent() {
  const searchParams = useSearchParams()
  const screenId = searchParams.get("id")
  const screen = getScreenById(screenId)

  const appInfo = platforms.find((p) => p.slug === screen.app) || platforms[0]
  const backHref = `/?app=${screen.app}&category=${encodeURIComponent(screen.category)}`

  return (
    <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-10">
      {/* Left Side: Back Arrow + Feature / Screen Title */}
      <div className="flex min-w-0 items-center gap-4">
        <Link
          aria-label="Back to library"
          className={cn(
            buttonVariants({ size: "icon-lg", variant: "secondary" }),
            "size-11 shrink-0 rounded-full border border-[var(--nexus-border)] bg-white text-black shadow-2xs transition-all hover:bg-[#f0f0f0] active:scale-95"
          )}
          href={backHref}
        >
          <ArrowLeft className="size-5" />
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold leading-tight text-black sm:text-2xl">
            {screen.title}
          </h1>
          <p className="truncate text-xs font-medium text-[#8b8b8b] sm:hidden">
            {screen.platform}
          </p>
        </div>
      </div>

      {/* Right Side: Product Platform Badge / Info */}
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <div className="flex items-center gap-2 rounded-full pl-4 pr-2 py-2 text-sm font-semibold text-[#202020]">
          <span className="text-[#8b8b8b]">{appInfo.name}</span>
          <span className="text-[#c9d1d5]">/</span>
          <span className="text-black">{screen.platform}</span>
          <span className="text-[#c9d1d5]">/</span>
          <span className="ml-1 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-[#666666]">
            {screen.count}
          </span>
        </div>
      </div>
    </div>
  )
}

export function GalleryTitleBar() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 pt-6 sm:px-8 lg:px-10">
          <div className="flex items-center gap-4">
            <div className="size-11 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-200" />
          </div>
          <div className="h-9 w-40 animate-pulse rounded-full bg-zinc-200" />
        </div>
      }
    >
      <GalleryTitleBarContent />
    </React.Suspense>
  )
}
