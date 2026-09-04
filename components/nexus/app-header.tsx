"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getActiveAppFromParams, platforms } from "@/lib/nexus-data"
import { cn } from "@/lib/utils"

function SearchInput({
  activeSlug,
  onSearch,
  onClear,
  initialValue,
}: {
  activeSlug: string
  onSearch: (value: string) => void
  onClear: () => void
  initialValue: string
}) {
  const [value, setValue] = React.useState(initialValue)

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
        placeholder={`Search ${platforms.find((p) => p.slug === activeSlug)?.name || "UI Elements"}...`}
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
  const [pushDesignOpen, setPushDesignOpen] = React.useState(false)

  const activeSlug = React.useMemo(
    () => getActiveAppFromParams(searchParams),
    [searchParams]
  )

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set("q", value.trim())
    } else {
      params.delete("q")
    }
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  const handleClearSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("q")
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 border-b border-[var(--nexus-border)] bg-white/95 backdrop-blur-md transition-shadow duration-200",
          className
        )}
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3.5 px-5 py-3.5 sm:px-8 lg:h-[80px] lg:flex-row lg:items-center lg:gap-6 xl:gap-8 lg:px-10 lg:py-0">
          <div className="flex items-center justify-between gap-4 lg:contents">
            <Link
              href="/"
              className="flex shrink-0 items-center text-[20px] font-extrabold tracking-tight text-black transition-opacity hover:opacity-85 sm:text-[22px]"
            >
              Asphalt Nexus
            </Link>

            <Button
              onClick={() => setPushDesignOpen(true)}
              className="h-11 shrink-0 rounded-full bg-[#008a0d] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#00720b] active:scale-[0.98] lg:hidden"
            >
              Push Design
            </Button>
          </div>

          <form
            onSubmit={(e) => e.preventDefault()}
            role="search"
            className="flex-1"
          >
            <SearchInput
              key={currentQ}
              initialValue={currentQ}
              activeSlug={activeSlug}
              onSearch={handleSearch}
              onClear={handleClearSearch}
            />
          </form>

          <div className="flex min-w-0 flex-wrap items-center gap-3 lg:ml-auto lg:flex-nowrap lg:gap-4">
            <nav
              aria-label="Application sections"
              className="flex h-11 min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-[#f4f4f4] p-1 text-sm font-semibold"
            >
              {platforms.map((platform) => {
                const isActive = activeSlug === platform.slug
                return (
                  <Link
                    key={platform.slug}
                    href={platform.href}
                    className={cn(
                      "flex h-full shrink-0 items-center rounded-full px-4 text-sm font-semibold leading-none transition-all duration-200",
                      isActive
                        ? "bg-white text-black font-bold shadow-xs"
                        : "text-[#666666] hover:text-black hover:bg-black/5"
                    )}
                  >
                    {platform.name}
                  </Link>
                )
              })}
            </nav>

            <Button
              onClick={() => setPushDesignOpen(true)}
              className="hidden h-11 shrink-0 rounded-full bg-[#008a0d] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#00720b] active:scale-[0.98] lg:inline-flex"
            >
              Push Design
            </Button>
          </div>
        </div>
      </header>

      {/* Push Design Dialog / Modal */}
      {pushDesignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-black">Push Design</h2>
              <button
                type="button"
                onClick={() => setPushDesignOpen(false)}
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-black"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="py-4 text-sm text-zinc-600">
              <p>
                Ready to push new screens or component updates to the{" "}
                <span className="font-semibold text-black">
                  {platforms.find((p) => p.slug === activeSlug)?.name}
                </span>{" "}
                library?
              </p>
              <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
                Connected repository: <code>asphalt-nexus / {activeSlug}-app</code>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setPushDesignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#008a0d] hover:bg-[#00720b]"
                onClick={() => {
                  alert("Design sync initiated successfully!")
                  setPushDesignOpen(false)
                }}
              >
                Sync Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
