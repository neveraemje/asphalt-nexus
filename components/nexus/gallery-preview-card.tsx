"use client"

import Image from "next/image"
import Link from "next/link"

import { useNexusData } from "@/components/nexus/nexus-data-provider"

type GalleryPreviewCardProps = {
  href: string
  image: string
  priority?: boolean
  recordId: string
  sourceUrl?: string
  title: string
  platform?: string
}

export function GalleryPreviewCard({
  href,
  image,
  priority,
  recordId,
  sourceUrl,
  title,
  platform,
}: GalleryPreviewCardProps) {
  const { incrementMetric } = useNexusData()

  function countSourceOpen() {
    void incrementMetric(recordId, "open").catch((metricError) => {
      console.warn("Could not count the source open.", metricError)
    })
  }

  return (
    <div className="group relative h-[548px] w-[252.8px] overflow-hidden rounded-[32px] border border-[#c9d1d5] bg-white shadow-2xs transition hover:shadow-md">
      <Image
        alt={title}
        className="size-full object-cover object-top"
        height={548}
        priority={priority}
        src={image}
        width={253}
      />
      <Link
        aria-label={`Open ${title}`}
        className="absolute inset-0 rounded-[32px]"
        href={href}
      />

      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="absolute inset-0 bg-white/70" />
        <div className="absolute inset-x-0 bottom-0 h-[169px] bg-gradient-to-t from-white via-white/95 to-white/0" />
        <div className="absolute bottom-[74px] left-[15px] w-[221px]">
          <p className="text-sm leading-normal text-[#4c4c4c]">
            {platform || "Screen"}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold leading-6 text-[#202020]">
            {title}
          </p>
        </div>
        <div className="pointer-events-auto absolute bottom-[15px] left-1/2 flex w-[221px] -translate-x-1/2 gap-2">
          {sourceUrl ? (
            <a
              className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-[32px] border border-[var(--nexus-border)] bg-white px-3 text-xs font-semibold text-[#202020] transition hover:bg-[#f1f1f1] focus-visible:ring-3 focus-visible:ring-[#008a0d]/25"
              href={sourceUrl}
              onClick={countSourceOpen}
              rel="noreferrer"
              target="_blank"
            >
              Open source
            </a>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-[32px] border border-[var(--nexus-border)] bg-white px-3 text-xs font-semibold text-[#8b8b8b] opacity-60"
            >
              Open source
            </span>
          )}
          <Link
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-[32px] bg-[#008a0d] px-5 text-xs font-semibold leading-6 text-white transition hover:bg-[#00720b] focus-visible:ring-[#008a0d]/25"
            href={href}
          >
            View
          </Link>
        </div>
      </div>
    </div>
  )
}
