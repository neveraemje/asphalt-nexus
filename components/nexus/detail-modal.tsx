"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { InformationArchitectureTree } from "@/components/nexus/information-architecture-tree"
import { useNexusData } from "@/components/nexus/nexus-data-provider"
import { PhonePreview } from "@/components/nexus/phone-preview"
import {
  formatViews,
  getGalleryScreens,
  getGalleryVariant,
  getScreenById,
  platforms,
} from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

function DetailModalContent() {
  const searchParams = useSearchParams()
  const screenId = searchParams.get("id")
  const variant = searchParams.get("variant")
  const previewScrollRef = React.useRef<HTMLDivElement>(null)
  const viewedScreenRef = React.useRef<string | null>(null)
  const { incrementMetric, loading, records, screenCards } = useNexusData()
  const screen = getScreenById(screenCards, screenId)
  const variants = getGalleryScreens(records, screenId)
  const activeVariant = getGalleryVariant(variants, variant)
  const activeIndex = activeVariant
    ? Math.max(0, variants.findIndex((item) => item.id === activeVariant.id))
    : 0
  const prevVariant = variants[(activeIndex - 1 + variants.length) % variants.length]?.id
  const nextVariant = variants[(activeIndex + 1) % variants.length]?.id

  React.useEffect(() => {
    previewScrollRef.current?.scrollTo({ top: 0 })
  }, [activeVariant?.id, screen?.id])

  React.useEffect(() => {
    if (!activeVariant?.id || viewedScreenRef.current === activeVariant.id) return

    const viewSessionKey = `nexus-screen-viewed:${activeVariant.id}`
    viewedScreenRef.current = activeVariant.id

    try {
      if (window.sessionStorage.getItem(viewSessionKey)) return
      window.sessionStorage.setItem(viewSessionKey, "true")
    } catch {
      // The in-memory guard still prevents duplicate counts during this mount.
    }

    void incrementMetric(activeVariant.id, "view").catch((metricError) => {
      try {
        window.sessionStorage.removeItem(viewSessionKey)
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
      console.warn("Could not count the screen view.", metricError)
    })
  }, [activeVariant?.id, incrementMetric])

  if (loading) return null

  if (!screen || !activeVariant) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
        <div className="rounded-[20px] bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold">Screen not found</h1>
          <Link className="mt-5 inline-flex text-sm font-semibold text-[#008a0d]" href="/">
            Return to library
          </Link>
        </div>
      </div>
    )
  }

  const appInfo = platforms.find((p) => p.slug === screen.app) || platforms[0]
  const title = activeVariant.title
  const closeHref = `/gallery/home-screen?id=${encodeURIComponent(screen.id)}`
  const categoryHref = `/?app=${screen.app}&category=${encodeURIComponent(screen.category)}`
  const updatedAt = new Date(activeVariant.updatedAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const creatorName = activeVariant.createdByName || "Nexus contributor"
  const creatorInitial = creatorName.trim().charAt(0).toUpperCase() || "N"

  // Opens the exact source frame that was saved when this screen was pushed.
  function openSourceScreen() {
    if (!activeVariant.sourceUrl) return
    window.open(activeVariant.sourceUrl, "_blank", "noopener,noreferrer")
    void incrementMetric(activeVariant.id, "open").catch((metricError) => {
      console.warn("Could not count the source open.", metricError)
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[rgba(28,29,29,0.6)] p-3 backdrop-blur-xs animate-in fade-in duration-200 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-[1380px] flex-col gap-3 overflow-hidden sm:h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)] lg:flex-row">

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[24px] bg-white shadow-xl">
          <div className="shrink-0 z-20 flex items-center justify-between border-b border-[var(--nexus-border)] bg-[#f9f9f9] px-4 py-3.5 sm:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#a6e8ff] text-base font-bold text-[#202020]">
                {creatorInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-5 text-[#202020]">
                  {creatorName}
                </p>
                <p className="truncate text-xs leading-4 text-[#666666]">
                  Last update: {updatedAt}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  disabled={!activeVariant.sourceUrl}
                  onClick={openSourceScreen}
                  className="inline-flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-[32px] border border-[var(--nexus-border)] bg-white px-4 text-sm font-semibold text-[#202020] hover:bg-[#f1f1f1] cursor-pointer"
                >
                  <Image
                    alt=""
                    aria-hidden="true"
                    height={20}
                    src="/icons/figma-logo.svg"
                    width={20}
                  />
                  Open screen
                </Button>
              </div>
            </div>
          </div>

          <Link
            href={`/gallery/home-screen/detail?id=${encodeURIComponent(screen.id)}&variant=${encodeURIComponent(prevVariant || "")}`}
            aria-label="Previous screen"
            scroll={false}
            className={cn(
              buttonVariants({ size: "icon-lg", variant: "secondary" }),
              "absolute left-4 top-1/2 z-30 hidden size-12 rounded-full bg-[#e7e7e7]/90 text-[#4c4c4c] hover:bg-[#dadada] sm:flex"
            )}
          >
            <ArrowLeft className="size-5" />
          </Link>

          <Link
            href={`/gallery/home-screen/detail?id=${encodeURIComponent(screen.id)}&variant=${encodeURIComponent(nextVariant || "")}`}
            aria-label="Next screen"
            scroll={false}
            className={cn(
              buttonVariants({ size: "icon-lg", variant: "secondary" }),
              "absolute right-4 top-1/2 z-30 hidden size-12 rounded-full bg-[#e7e7e7]/90 text-[#4c4c4c] hover:bg-[#dadada] sm:flex"
            )}
          >
            <ArrowRight className="size-5" />
          </Link>

          <div
            ref={previewScrollRef}
            className="relative flex flex-1 items-start justify-center overflow-y-auto px-4 py-8 overscroll-contain [scrollbar-width:thin] [scrollbar-color:#c9d1d5_transparent]"
          >
            <div className="relative flex min-h-full flex-col items-center justify-center">
              <PhonePreview
                alt={`${title} preview`}
                image={activeVariant.image}
                priority
                size="detail"
              />
            </div>
          </div>
        </section>

        <aside className="flex flex-col overflow-hidden rounded-[24px] bg-white shadow-xl lg:w-[400px] shrink-0">
          <div className="shrink-0 border-b border-[var(--nexus-border)] bg-[#f9f9f9] px-6 py-6 sm:px-8 sm:pb-6 sm:pt-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <nav
                  aria-label="Breadcrumb"
                  className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold leading-none text-[#8b8b8b]"
                >
                  <Link className="transition-colors hover:text-[#202020]" href={appInfo.href}>
                    {appInfo.name}
                  </Link>
                  <span className="text-[#c9d1d5]">/</span>
                  <Link className="transition-colors hover:text-[#202020]" href={categoryHref}>
                    {activeVariant.platform}
                  </Link>

                </nav>
                <h2 className="mt-3 text-xl font-bold leading-tight text-[#202020]">
                  {title}
                </h2>
              </div>
              <Link
                aria-label="Close detail"
                className={cn(
                  buttonVariants({ size: "icon-lg", variant: "secondary" }),
                  "size-10 shrink-0 rounded-full bg-[#e7e7e7] text-[#202020] hover:bg-[#dadada] transition-transform active:scale-95"
                )}
                href={closeHref}
              >
                <X className="size-5" />
              </Link>
            </div>

            <dl className="mt-5 flex gap-6">
              {[
                [String(activeVariant.pulls), "Open"],
                [activeVariant.size, "Size"],
                [formatViews(activeVariant.views), "Views"],
              ].map(([value, label]) => (
                <div className="min-w-14" key={label}>
                  <dt className="text-md font-bold leading-6 text-[#202020]">
                    {value}
                  </dt>
                  <dd className="mt-0.5 text-xs font-medium leading-4 text-[#666666]">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 overscroll-contain [scrollbar-width:thin] [scrollbar-color:#c9d1d5_transparent]">
            <h3 className="text-md font-bold leading-5 text-[#202020]">
              Information Architecture
            </h3>

            <div className="mt-5">
              <InformationArchitectureTree
                regions={activeVariant.architecture}
                screenName={title}
              />
            </div>

            <Button
              disabled={!activeVariant.sourceUrl}
              onClick={openSourceScreen}
              className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[32px] border border-[var(--nexus-border)] bg-white px-4 text-sm font-semibold text-[#202020] hover:bg-[#f1f1f1] sm:hidden"
            >
              <Image
                alt=""
                aria-hidden="true"
                height={20}
                src="/icons/figma-logo.svg"
                width={20}
              />
              Open screen
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function DetailModal() {
  return (
    <React.Suspense fallback={null}>
      <DetailModalContent />
    </React.Suspense>
  )
}
