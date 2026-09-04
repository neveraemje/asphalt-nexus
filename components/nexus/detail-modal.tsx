"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ExternalLink,
  Layers,
  X,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
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
  const screen = getScreenById(screenId)
  const variants = getGalleryScreens(screenId)
  const activeVariant = getGalleryVariant(screenId, variant)

  const safeVariantNum = activeVariant.id
  const prevVariant = safeVariantNum > 1 ? safeVariantNum - 1 : variants.length
  const nextVariant = safeVariantNum < variants.length ? safeVariantNum + 1 : 1

  const appInfo = platforms.find((p) => p.slug === screen.app) || platforms[0]
  const title = variant ? `${activeVariant.title} (Variant ${safeVariantNum})` : activeVariant.title
  const closeHref = `/gallery/home-screen?id=${screen.id}`
  const categoryHref = `/?app=${screen.app}&category=${encodeURIComponent(screen.category)}`

  React.useEffect(() => {
    previewScrollRef.current?.scrollTo({ top: 0 })
  }, [screen.id, safeVariantNum])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[rgba(28,29,29,0.6)] p-3 backdrop-blur-xs animate-in fade-in duration-200 sm:p-6 lg:p-8">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-[1380px] flex-col gap-3 overflow-hidden sm:h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)] lg:flex-row">

        <section className="relative flex flex-1 flex-col overflow-hidden rounded-[24px] bg-white shadow-xl">
          <div className="shrink-0 z-20 flex items-center justify-between border-b border-[var(--nexus-border)] bg-[#f9f9f9] px-4 py-3.5 sm:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#a6e8ff] text-base font-bold text-[#202020]">
                J
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-5 text-[#202020]">
                  Jaison Justus
                </p>
                <p className="truncate text-xs leading-4 text-[#666666]">
                  Last Update : Aug 2, 2026
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  onClick={() => alert("Item delete action")}
                  className="h-10 w-[106px] rounded-[32px] border border-[var(--nexus-border)] bg-white px-5 text-sm font-semibold text-[#d60027] hover:bg-[#fff5f7] cursor-pointer"
                >
                  Delete
                </Button>
                <Button
                  onClick={() => alert("Design pulled to Figma clipboard!")}
                  className="h-10 w-[106px] rounded-[32px] border border-[var(--nexus-border)] bg-white px-5 text-sm font-semibold text-[#202020] hover:bg-[#f1f1f1] cursor-pointer"
                >
                  Pull design
                </Button>
              </div>
              <div className="hidden h-6 w-px bg-[var(--nexus-border)] sm:block" />
              <Button
                aria-label="Open in Figma"
                className="size-10 shrink-0 rounded-full bg-[#e7e7e7] text-[#202020] hover:bg-[#dadada] cursor-pointer transition-transform active:scale-95"
                size="icon-lg"
                variant="secondary"
                onClick={() => alert("Opening component in Figma...")}
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  height={24}
                  src="/icons/figma-logo.svg"
                  width={24}
                />
              </Button>
            </div>
          </div>

          <Link
            href={`/gallery/home-screen/detail?id=${screen.id}&variant=${prevVariant}`}
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
            href={`/gallery/home-screen/detail?id=${screen.id}&variant=${nextVariant}`}
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
                [String(activeVariant.pulls), "Pulls"],
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

            <div className="mt-5 flex flex-col gap-6">
              {activeVariant.architecture.map((group, index) => {
                const Icon = index % 2 === 0 ? Layers : Box

                return (
                  <section className="relative pl-7" key={group.title}>
                    <Icon className="absolute left-0 top-0.5 size-4.5 text-[#008a0d]" />
                    <div className="absolute bottom-0 left-[8px] top-6 w-px bg-[#e0e0e0]" />
                    <h4 className="truncate text-base font-semibold leading-5 text-[#202020]">
                      {group.title}
                    </h4>
                    <ul className="mt-2.5 space-y-2">
                      {group.items.map((item) => (
                        <li
                          className="flex items-center gap-2 text-[13px] font-medium leading-5 text-[#555555]"
                          key={item}
                        >
                          <span className="size-1 rounded-full bg-zinc-300" />
                          <span className="truncate">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>

            <Button
              onClick={() => alert("Design pulled to Figma clipboard!")}
              className="mt-6 h-10 w-full rounded-[32px] border border-[var(--nexus-border)] bg-white px-4 text-sm font-semibold text-[#202020] hover:bg-[#f1f1f1] sm:hidden"
            >
              <ExternalLink className="size-4 mr-2" />
              Pull design
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
