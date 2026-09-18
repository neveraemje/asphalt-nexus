"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { useNexusData } from "@/components/nexus/nexus-data-provider"
import { appTabs, getActiveAppFromParams } from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

function SearchInput({
  onSearch,
  onClear,
  initialValue,
}: {
  onSearch: (value: string) => void
  onClear: () => void
  initialValue: string
}) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    // URL navigation can clear or restore the persistent header search.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialValue)
  }, [initialValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setValue(val)
    onSearch(val)
  }

  const handleClear = () => {
    setValue("")
    onClear()
  }

  return (
    <div className="relative h-11 w-full lg:max-w-[480px] xl:max-w-[560px] lg:flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#666666]"
        strokeWidth={2}
      />
      <input
        aria-label="Search UI element"
        className="h-11 w-full rounded-full border border-[var(--nexus-border)] bg-[#f9f9f9] pl-11 pr-10 text-sm text-black outline-none transition placeholder:text-[#8b8b8b] focus:border-[#008a0d] focus:bg-white focus:ring-2 focus:ring-[#008a0d]/20"
        placeholder="Search all UI elements..."
        type="search"
        value={value}
        onChange={handleChange}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8b8b8b] hover:bg-zinc-200 hover:text-black"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

function AppHeaderContent({ className }: { className?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQ = searchParams.get("q") || ""
  const { screenCards } = useNexusData()

  const activeSlug = React.useMemo(
    () => screenCards.find((screen) => screen.id === searchParams.get("id"))?.app
      || getActiveAppFromParams(searchParams),
    [screenCards, searchParams]
  )

  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    if (activeSlug !== "all") params.set("app", activeSlug)
    if (value.trim()) {
      params.set("q", value.trim())
    }
    router.replace(`/?${params.toString()}`, { scroll: false })
  }

  const handleClearSearch = () => {
    router.replace(activeSlug === "all" ? "/" : `/?app=${activeSlug}`, { scroll: false })
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-[var(--nexus-border)] bg-white/95 backdrop-blur-md transition-shadow duration-200",
        className
      )}
    >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3.5 px-5 py-3.5 sm:px-8 lg:h-[80px] lg:flex-row lg:items-center lg:gap-6 xl:gap-8 lg:px-10 lg:py-0">
          <div className="flex items-center gap-4 lg:contents">
            <Link
              href="/"
              className="flex shrink-0 items-center text-[20px] font-extrabold tracking-tight text-black transition-opacity hover:opacity-85 sm:text-[22px]"
            >
              Asphalt Nexus
            </Link>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            role="search"
            className="flex-1"
          >
            <SearchInput
              initialValue={currentQ}
              onSearch={handleSearch}
              onClear={handleClearSearch}
            />
          </form>

          <div className="flex min-w-0 flex-wrap items-center gap-3 lg:ml-auto lg:flex-nowrap lg:gap-4">
            <nav
              aria-label="Application sections"
              className="flex h-11 min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-[#f4f4f4] p-1 text-sm font-semibold"
            >
              {appTabs.map((platform) => {
                const isActive = activeSlug === platform.slug
                return (
                  <Link
                    key={platform.slug}
                    href={platform.href}
                    className={cn(
                      "flex h-full shrink-0 items-center rounded-full px-4 text-sm font-semibold leading-none transition-all duration-200",
                      isActive
                        ? "bg-[#008a0d] text-white font-bold shadow-xs"
                        : "text-[#666666] hover:text-black hover:bg-black/5"
                    )}
                  >
                    {platform.name}
                  </Link>
                )
              })}
            </nav>

          </div>
        </div>
    </header>
  )
}

export function AppHeader({ className }: { className?: string }) {
  return (
    <React.Suspense
      fallback={
        <header
          className={cn(
            "sticky top-0 z-30 border-b border-[var(--nexus-border)] bg-white",
            className
          )}
        >
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3.5 px-5 py-3.5 sm:px-8 lg:h-[80px] lg:flex-row lg:items-center lg:gap-6 xl:gap-8 lg:px-10 lg:py-0">
            <div className="flex shrink-0 items-center text-[20px] font-extrabold tracking-tight text-black sm:text-[22px]">
              Asphalt Nexus
            </div>
          </div>
        </header>
      }
    >
      <AppHeaderContent className={className} />
    </React.Suspense>
  )
}
