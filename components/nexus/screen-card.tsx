import Link from "next/link"

import type { ScreenCard as ScreenCardType } from "@/lib/nexus-data"
import { PhonePreview } from "@/components/nexus/phone-preview"

type ScreenCardProps = {
  screen: ScreenCardType
  priority?: boolean
}

export function ScreenCard({ priority, screen }: ScreenCardProps) {
  return (
    <article className="group flex min-w-0 flex-col gap-4">
      <Link
        className="flex h-[360px] items-center justify-center overflow-hidden rounded-[24px] bg-[#e8f0f4] outline-none transition group-hover:bg-[#dfe9ee] focus-visible:ring-3 focus-visible:ring-[#008a0d]/25 sm:h-[460px] xl:h-[580px]"
        href={screen.href}
      >
        <div className="scale-[0.58] sm:scale-[0.78] xl:scale-100">
          <PhonePreview
            alt={`${screen.title} preview`}
            image={screen.image}
            priority={priority}
          />
        </div>
      </Link>
      <div className="flex h-[50px] flex-col gap-1">
        <div className="flex items-start gap-1 text-sm leading-5 text-[#4c4c4c]">
          <p className="min-w-0 flex-1 truncate">{screen.platform}</p>
          <p className="shrink-0 whitespace-nowrap ml-1 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-[#666666]">{screen.count}</p>
        </div>
        <h2 className="truncate text-l font-semibold leading-6 text-[#202020]">
          <Link href={screen.href}>{screen.title}</Link>
        </h2>
      </div>
    </article>
  )
}
