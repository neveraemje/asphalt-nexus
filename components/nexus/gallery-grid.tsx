"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { GalleryPreviewCard } from "@/components/nexus/gallery-preview-card"
import { PhonePreview } from "@/components/nexus/phone-preview"
import { getGalleryScreens, getScreenById } from "@/lib/nexus-data"

function GalleryGridContent({ muted = false }: { muted?: boolean }) {
  const searchParams = useSearchParams()
  const screenId = searchParams.get("id")
  const currentScreen = getScreenById(screenId)
  const screens = getGalleryScreens(screenId)

  return (
    <section
      aria-label={`${currentScreen.title} previews`}
      className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-5 pb-16 pt-8 min-[560px]:grid-cols-2 sm:px-8 md:grid-cols-3 lg:grid-cols-5 lg:px-10"
    >
      {screens.map((screen, index) => (
        <div
          className="flex h-[400px] justify-center sm:h-[477px] lg:h-[548px]"
          key={screen.id}
        >
          <div className="origin-top scale-[0.73] sm:scale-[0.87] lg:scale-100">
            {muted ? (
              <PhonePreview
                alt={screen.title}
                image={screen.image}
                priority={index < 5}
                size="gallery"
              />
            ) : (
              <GalleryPreviewCard
                href={screen.href}
                image={screen.image}
                platform={screen.platform}
                priority={index < 5}
                title={screen.title}
              />
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

export function GalleryGrid({ muted = false }: { muted?: boolean }) {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-5 pb-16 pt-8 min-[560px]:grid-cols-2 sm:px-8 md:grid-cols-3 lg:grid-cols-5 lg:px-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[450px] animate-pulse rounded-[32px] bg-zinc-200" />
          ))}
        </div>
      }
    >
      <GalleryGridContent muted={muted} />
    </React.Suspense>
  )
}
