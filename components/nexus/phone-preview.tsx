import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

type PhonePreviewProps = {
  alt: string
  href?: string
  image: string
  size?: "card" | "gallery" | "detail"
  priority?: boolean
}

const sizes = {
  card: {
    frame: "h-[519px] w-[240px]",
    image: "h-[519px] w-[240px]",
  },
  gallery: {
    frame: "h-[548px] w-[252.8px]",
    image: "h-[548px] w-[252.8px]",
  },
  detail: {
    frame: "w-[310px] sm:w-[335px]",
  },
}

export function PhonePreview({
  alt,
  href,
  image,
  priority,
  size = "card",
}: PhonePreviewProps) {
  if (size === "detail") {
    const imageHeight = image.includes("-long") ? 7350 : 2556
    const detailContent = (
      <div
        className={cn(
          "group/phone relative block overflow-hidden rounded-[32px] bg-transparent shadow-2xl",
          sizes.detail.frame
        )}
      >
        <Image
          alt={alt}
          className="block h-auto w-full object-cover object-top"
          height={imageHeight}
          priority={priority}
          src={image}
          width={1179}
        />
      </div>
    )

    if (!href) return detailContent

    return (
      <Link
        aria-label={`Open ${alt}`}
        className="block rounded-[38px] outline-none focus-visible:ring-3 focus-visible:ring-[#008a0d]/25"
        href={href}
      >
        {detailContent}
      </Link>
    )
  }

  const preview = (
    <span
      className={cn(
        "block overflow-hidden rounded-[24px]",
        size !== "card" && "rounded-[32px] border border-[#c9d1d5]",
        sizes[size].frame
      )}
    >
      <Image
        alt={alt}
        className={cn("object-cover", sizes[size].image)}
        height={size === "gallery" ? 548 : 519}
        priority={priority}
        src={image}
        width={size === "gallery" ? 253 : 240}
      />
    </span>
  )

  if (!href) {
    return preview
  }

  return (
    <Link
      aria-label={`Open ${alt}`}
      className="block rounded-[32px] outline-none focus-visible:ring-3 focus-visible:ring-[#008a0d]/25"
      href={href}
    >
      {preview}
    </Link>
  )
}
