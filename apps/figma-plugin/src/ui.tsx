/* eslint-disable @next/next/no-img-element */

import { HierarchySquare01Icon, TextSquareIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, LoaderCircle, PencilLine, Plus, Search, Trash2, X } from "lucide-react"
import { createRoot } from "react-dom/client"
import { type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

import { Button } from "./components/ui/button"
import { Checkbox } from "./components/ui/checkbox"
import { Input } from "./components/ui/input"
import { Switch } from "./components/ui/switch"
import { generateInformationArchitecture } from "./ia"
import { cn } from "./lib/utils"

type AppSlug = "consumer" | "merchant" | "driver"
type Route = "browse" | "gallery" | "detail" | "push"

type NexusScreen = {
  app: AppSlug
  category: string
  id: string
  platform: string
  previewImage?: string
  record?: ScreenRecord
  size: string
  title: string
}

type FeatureCollection = {
  app: AppSlug
  count: string
  featureName: string
  id: string
  previewImage?: string
  screens: NexusScreen[]
  team: string
}

type GalleryItem = {
  componentKey?: string
  detailImage: string
  id: string
  opens: string
  record?: ScreenRecord
  screen: NexusScreen
  size: string
  storageNodeId?: string
  thumbnail: string
  title: string
  views: string
}

const apps: { label: string; value: AppSlug }[] = [
  {
    label: "Consumer App",
    value: "consumer",
  },
  {
    label: "Merchant App",
    value: "merchant",
  },
  {
    label: "Driver App",
    value: "driver",
  },
]

const formLabelClassName = "text-sm leading-5 text-[var(--nexus-caption)]"
const formPillValueClassName = "h-10 rounded-[32px] px-4 text-[16] font-medium"
const pendingButtonClassName = "border-transparent bg-[var(--nexus-preview)] text-[var(--nexus-caption)] hover:bg-[var(--nexus-preview)] disabled:opacity-100"
const lazyLoadRootMargin = "320px 0px"

const appOptions = ["Consumer App", "Merchant App", "Driver App"]

// Expands a collection when its loading sentinel approaches the plugin viewport.
function useProgressiveLimit(total: number, batchSize: number) {
  const [limit, setLimit] = useState(() => Math.min(total, batchSize))
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || limit >= total) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setLimit((currentLimit) => Math.min(total, currentLimit + batchSize))
    }, { rootMargin: lazyLoadRootMargin })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [batchSize, limit, total])

  return {
    hasMore: limit < total,
    limit,
    sentinelRef,
  }
}

// Defers the image request until the preview is close to becoming visible.
function LazyImage({
  alt,
  className,
  src,
}: {
  alt: string
  className?: string
  src: string
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(() => typeof IntersectionObserver === "undefined")

  useEffect(() => {
    const image = imageRef.current
    if (!image || shouldLoad) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setShouldLoad(true)
      observer.disconnect()
    }, { rootMargin: lazyLoadRootMargin })

    observer.observe(image)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <img
      alt={alt}
      aria-busy={!loaded}
      className={cn(className, loaded ? "opacity-100" : "opacity-0")}
      decoding="async"
      loading="lazy"
      onError={() => setLoaded(true)}
      onLoad={() => setLoaded(true)}
      ref={imageRef}
      src={shouldLoad ? src : undefined}
    />
  )
}

// Colors the shared Figma SVG through CSS while preserving the source asset shape.
function FigmaLogo({ className }: { className?: string }) {
  const maskImage = 'url("__ASSET_FIGMA_LOGO__")'

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block bg-current", className)}
      style={{
        WebkitMaskImage: maskImage,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskImage,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
      }}
    />
  )
}

// Keeps the next batch trigger visually quiet while communicating background work.
function LazyLoadSentinel({ sentinelRef }: { sentinelRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-label="Loading more screens"
      className="col-span-full flex h-10 items-center justify-center text-[var(--nexus-caption)]"
      ref={sentinelRef}
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin" />
    </div>
  )
}

// Sends messages from the plugin UI iframe to the Figma plugin controller.
function post(message: PluginMessage) {
  window.parent.postMessage({ pluginMessage: message }, "*")
}

// Owns the plugin UI state and switches between browse, gallery, and detail views.
function App() {
  const [activeApp, setActiveApp] = useState<AppSlug>("consumer")
  const [category, setCategory] = useState("All")
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [featureId, setFeatureId] = useState("")
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [pushedRecords, setPushedRecords] = useState<ScreenRecord[]>([])
  const [pushReturnRoute, setPushReturnRoute] = useState<Exclude<Route, "push">>("browse")
  const [query, setQuery] = useState("")
  const [route, setRoute] = useState<Route>("browse")
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([])
  const [selectedNodes, setSelectedNodes] = useState<SelectionNodeSummary[]>([])
  const [screenId, setScreenId] = useState("")
  const viewedDetailIdRef = useRef<string | null>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
      const message = event.data.pluginMessage
      if (!message) return

      if (message.type === "records-loaded") {
        console.log("[Asphalt Nexus UI] records-loaded", message.records.map(debugRecordUrl))
        setPushedRecords(message.records)
        setIsLoadingRecords(false)
      }

      if (message.type === "records-load-failed") {
        setPushedRecords([])
        setIsLoadingRecords(false)
      }

      if (message.type === "record-upserted") {
        console.log("[Asphalt Nexus UI] record-upserted", debugRecordUrl(message.record))
        setPushedRecords((records) => {
          const existingIndex = records.findIndex((record) => record.id === message.record.id)

          if (existingIndex === -1) return [message.record, ...records]
          return records.map((record) => record.id === message.record.id ? message.record : record)
        })
      }

      if (message.type === "record-updated") {
        console.log("[Asphalt Nexus UI] record-updated", debugRecordUrl(message.record))
        const updatedScreen = recordToNexusScreen(message.record)

        setPushedRecords((records) => records.map((record) => (
          record.id === message.record.id ? message.record : record
        )))
        post({ height: 860, type: "resize", width: 800 })
        setActiveApp(updatedScreen.app)
        setCategory(updatedScreen.category)
        setFeatureId(getFeatureCollectionId(updatedScreen))
        setScreenId(updatedScreen.id)
        setEditingRecordId(null)
        setRoute("detail")
      }

      if (message.type === "records-upserted") {
        console.log("[Asphalt Nexus UI] records-upserted", message.records.map(debugRecordUrl))
        const firstRecord = message.records[0]

        setPushedRecords((records) => [
          ...message.records,
          ...records.filter(
            (record) => !message.records.some((newRecord) => newRecord.id === record.id)
          ),
        ])

        if (firstRecord) {
          const firstScreen = recordToNexusScreen(firstRecord)
          post({ height: 860, type: "resize", width: 800 })
          setActiveApp(firstScreen.app)
          setCategory(firstScreen.category)
          setFeatureId(getFeatureCollectionId(firstScreen))
          setScreenId(firstScreen.id)
          setRoute("gallery")
        }
      }

      if (message.type === "record-deleted") {
        setPushedRecords((records) => records.filter((record) => record.id !== message.recordId))
        setPendingDeleteIds([])
        setSelectedScreenIds((ids) => ids.filter((id) => id !== message.recordId))
        setRoute("gallery")
      }

      if (message.type === "records-deleted") {
        const deletedIds = new Set(message.recordIds)
        setPushedRecords((records) => records.filter((record) => !deletedIds.has(record.id)))
        setPendingDeleteIds([])
        setSelectedScreenIds((ids) => ids.filter((id) => !deletedIds.has(id)))
        setRoute("gallery")
      }

      if (message.type === "records-delete-failed") {
        setPendingDeleteIds([])
      }

      if (message.type === "record-counts-updated") {
        setPushedRecords((records) => records.map((record) => (
          record.id === message.record.id
            ? {
              ...record,
              pullCount: message.record.pullCount,
              viewCount: message.record.viewCount,
            }
            : record
        )))
      }

      if (message.type === "selection-changed") {
        setSelectedNodes(message.nodes)
      }
    }

    window.addEventListener("message", onMessage)
    post({ type: "get-records" })
    post({ type: "get-selection" })
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const pushedScreens = useMemo(
    () => pushedRecords.map(recordToNexusScreen),
    [pushedRecords]
  )
  const featureCollections = useMemo(
    () => groupScreensByFeature(pushedScreens),
    [pushedScreens]
  )
  const app = apps.find((item) => item.value === activeApp) || apps[0]
  const availableCategories = useMemo(() => {
    const categories = featureCollections
      .filter((item) => item.app === activeApp)
      .map((item) => item.team)

    return ["All", ...Array.from(new Set(categories))]
  }, [activeApp, featureCollections])
  const activeCategory = availableCategories.includes(category) ? category : "All"

  const visibleFeatures = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase()
      return featureCollections.filter((item) => {
        const screenNames = item.screens.map((screen) => screen.title).join(" ")
        const hashtags = item.screens
          .flatMap((screen) => screen.record?.tags || [])
          .flatMap((tag) => [tag, `#${tag}`])
          .join(" ")
        const haystack = `${getAppLabel(item.app)} ${item.featureName} ${item.team} ${screenNames} ${hashtags}`.toLowerCase()
        if (normalizedQuery) return haystack.includes(normalizedQuery)

        const matchesCategory = activeCategory === "All" || item.team === activeCategory
        return item.app === activeApp && matchesCategory
      })
    },
    [activeApp, activeCategory, featureCollections, query]
  )
  const searchScreens = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return []

    return pushedScreens.filter((screen) => {
      const tags = screen.record?.tags || []
      const haystack = [
        getAppLabel(screen.app),
        screen.category,
        screen.platform,
        screen.title,
        ...tags,
        ...tags.map((tag) => `#${tag}`),
      ].join(" ").toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [pushedScreens, query])
  const feature = featureCollections.find((item) => item.id === featureId) || visibleFeatures[0]
  const screen = feature?.screens.find((item) => item.id === screenId) || feature?.screens[0]
  const screenIndex = feature && screen
    ? feature.screens.findIndex((item) => item.id === screen.id)
    : -1
  const detailItem = screen ? getGalleryItem(screen) : null

  useEffect(() => {
    if (route !== "detail" || !detailItem?.record?.id) {
      viewedDetailIdRef.current = null
      return
    }

    if (viewedDetailIdRef.current === detailItem.record.id) return

    viewedDetailIdRef.current = detailItem.record.id
    post({ recordId: detailItem.record.id, type: "increment-view" })
  }, [detailItem?.record?.id, route])

  // Changes the active product tab and resets the category to that product's first category.
  const selectApp = (value: AppSlug) => {
    const firstFeature = featureCollections.find((item) => item.app === value)

    setActiveApp(value)
    setCategory("All")
    setQuery("")
    setSelectedScreenIds([])
    setRoute("browse")
    if (firstFeature) {
      setFeatureId(firstFeature.id)
      setScreenId(firstFeature.screens[0]?.id || "")
    }
  }

  // Moves the detail carousel through the real screens stored under the active feature.
  const moveDetailCarousel = (direction: -1 | 1) => {
    if (!feature || feature.screens.length === 0) return

    const currentIndex = Math.max(0, screenIndex)
    const nextIndex = (currentIndex + direction + feature.screens.length) % feature.screens.length
    setScreenId(feature.screens[nextIndex].id)
  }

  // Opens the saved Figma URL for the clicked screen.
  const goToScreen = (item = detailItem) => {
    if (!item) return
    const sourceUrl = getScreenSourceUrl(item.record)

    console.log("[Asphalt Nexus UI] go-to-screen clicked", {
      record: item.record ? debugRecordUrl(item.record) : undefined,
      resolvedSourceUrl: sourceUrl,
      title: item.title,
    })

    if (sourceUrl) {
      post({
        recordId: item.record?.id,
        sourceUrl,
        type: "open-source-url",
      })
      return
    }

    if (!hasEditablePullTarget(item)) {
      post({ message: "This screen does not have a saved Figma URL yet. Re-push it first.", type: "notify" })
      return
    }

    post({
      app: getAppLabel(item.screen.app),
      componentKey: item.componentKey,
      platform: item.screen.platform,
      recordId: item.record?.id,
      size: item.size,
      storageNodeId: item.storageNodeId,
      title: item.title,
      type: "insert-screen",
    })
  }

  // Deletes the clicked stored record from plugin metadata storage.
  const deleteScreen = (item: GalleryItem) => {
    if (!item.record) {
      post({ message: "Delete only works for pushed screens.", type: "notify" })
      return
    }

    if (pendingDeleteIds.length > 0) return
    setPendingDeleteIds([item.record.id])
    post({ recordIds: [item.record.id], type: "delete-records" })
  }

  // Opens the push form in edit mode with metadata from the stored screen record.
  const editScreen = (item: GalleryItem) => {
    if (!item.record) {
      post({ message: "Edit only works for pushed screens.", type: "notify" })
      return
    }

    setPushReturnRoute(route === "push" ? "detail" : route)
    setEditingRecordId(item.record.id)
    post({ type: "get-selection" })
    post({ height: 957, type: "resize", width: 800 })
    setRoute("push")
  }

  // Deletes all checked screens from the current feature in one controller operation.
  const deleteSelectedScreens = () => {
    if (selectedScreenIds.length === 0 || pendingDeleteIds.length > 0) return
    setPendingDeleteIds(selectedScreenIds)
    post({ recordIds: selectedScreenIds, type: "delete-records" })
  }

  // Opens the dedicated bulk Push Design view and remembers where Back should return.
  const openPushDesign = () => {
    setPushReturnRoute(route === "push" ? "browse" : route)
    setEditingRecordId(null)
    post({ type: "get-selection" })
    post({ height: 957, type: "resize", width: 800 })
    setRoute("push")
  }

  // Restores the gallery window size when leaving the full-screen push workflow.
  const closePushDesign = () => {
    post({ height: 860, type: "resize", width: 800 })
    setEditingRecordId(null)
    setRoute(pushReturnRoute)
  }

  if (route === "push") {
    const editingRecord = editingRecordId
      ? pushedRecords.find((record) => record.id === editingRecordId)
      : undefined

    return (
      <PushDesignScreen
        editRecord={editingRecord}
        initialApp={getAppLabel(activeApp)}
        records={pushedRecords}
        selectedNodes={selectedNodes}
        onClose={closePushDesign}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[var(--nexus-background)] text-[var(--nexus-text)]">
      <PluginHeader
        onHome={() => {
          setQuery("")
          setCategory("All")
          setFeatureId("")
          setScreenId("")
          setSelectedScreenIds([])
          setRoute("browse")
        }}
        query={query}
        onPush={openPushDesign}
        onQueryChange={(value) => {
          setQuery(value)
          setCategory("All")
          setSelectedScreenIds([])
          setRoute("browse")
        }}
      />

      {route === "browse" ? (
        <>
          {isLoadingRecords ? (
            <LoadingState />
          ) : (
            <>
              <ProductTabs
                activeApp={activeApp}
                searching={Boolean(query.trim())}
                onSelectApp={selectApp}
              />
              {!query.trim() ? (
                <CategoryChips
                  activeCategory={activeCategory}
                  categories={availableCategories}
                  onSelectCategory={setCategory}
                />
              ) : null}
              {query.trim() ? (
                searchScreens.length > 0 ? (
                  <SearchResults
                    screens={searchScreens}
                    onGoToScreen={(item) => goToScreen(item)}
                    onOpenDetail={(item) => {
                      setFeatureId(getFeatureCollectionId(item.screen))
                      setScreenId(item.screen.id)
                      setRoute("detail")
                    }}
                  />
                ) : (
                  <SearchEmptyState query={query} />
                )
              ) : visibleFeatures.length > 0 ? (
                <BrowseResults
                  key={`${activeApp}:${activeCategory}:${query}`}
                  features={visibleFeatures}
                  onOpenFeature={(item) => {
                    setFeatureId(item.id)
                    setScreenId(item.screens[0]?.id || "")
                    setSelectedScreenIds([])
                    setRoute("gallery")
                  }}
                />
              ) : (
                <EmptyState appName={app.label} />
              )}
            </>
          )}
        </>
      ) : feature ? (
        <>
          <GalleryTitleBar
            isDeleting={pendingDeleteIds.length > 0}
            feature={feature}
            selectedCount={selectedScreenIds.length}
            onBack={() => {
              setSelectedScreenIds([])
              setRoute("browse")
            }}
            onDeleteSelected={deleteSelectedScreens}
          />
          <GalleryGrid
            key={feature.id}
            feature={feature}
            selectedScreenIds={selectedScreenIds}
            onOpenDetail={(item) => {
              setScreenId(item.screen.id)
              setRoute("detail")
            }}
            onGoToScreen={(item) => goToScreen(item)}
            onToggleScreen={(screenId) => {
              setSelectedScreenIds((ids) => ids.includes(screenId)
                ? ids.filter((id) => id !== screenId)
                : [...ids, screenId]
              )
            }}
          />
        </>
      ) : (
        <EmptyState appName={app.label} />
      )}

      {route === "detail" && detailItem ? (
        <DetailDialog
          isDeleting={pendingDeleteIds.includes(detailItem.record?.id || "")}
          item={detailItem}
          onDelete={() => deleteScreen(detailItem)}
          onClose={() => setRoute("gallery")}
          onNext={() => moveDetailCarousel(1)}
          onPrevious={() => moveDetailCarousel(-1)}
          onGoToScreen={() => goToScreen(detailItem)}
          onEdit={() => editScreen(detailItem)}
        />
      ) : null}
    </main>
  )
}

// Renders the fixed plugin header with branding, search, and the push-design action.
function PluginHeader({
  onHome,
  onPush,
  onQueryChange,
  query,
}: {
  onHome: () => void
  onPush: () => void
  onQueryChange: (value: string) => void
  query: string
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--nexus-border)] bg-white">
      <div className="mx-auto grid h-auto w-full max-w-[850px] grid-cols-[1fr_auto] items-center gap-4 px-6 py-5 min-[760px]:h-[72px] min-[760px]:grid-cols-[88px_minmax(180px,1fr)_auto] min-[760px]:gap-8 min-[760px]:py-0">
        <button
          aria-label="Go to Asphalt Nexus home"
          className="text-left text-[20px] font-bold leading-5 text-black outline-none transition-opacity hover:opacity-70 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--nexus-green)]/20"
          onClick={onHome}
          type="button"
        >
          Asphalt
          <br />
          Nexus
        </button>
        <label className="relative col-span-2 min-[760px]:col-span-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--nexus-text)]"
          />
          <Input
            aria-label="Search UI element"
            className="h-11 pl-12 rounded-full"
            placeholder="Search product, feature or UI elements"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button
            onClick={onPush}
            variant="primary"
          >
            Push Design
          </Button>
        </div>
      </div>
    </header>
  )
}

// Renders the top product tabs and highlights the selected app.
function ProductTabs({
  activeApp,
  onSelectApp,
  searching,
}: {
  activeApp: AppSlug
  onSelectApp: (value: AppSlug) => void
  searching: boolean
}) {
  return (
    <nav
      aria-label="Product navigation"
      className="mx-auto grid h-[52px] w-full max-w-[850px] grid-cols-3 overflow-x-auto border-b border-[var(--nexus-border)] bg-white px-6"
    >
      {apps.map((item) => (
        <button
          key={item.value}
          className={cn(
            "relative min-w-[180px] px-2 pb-2 pt-3 text-center text-[12px] font-semibold leading-7 transition hover:text-black min-[760px]:text-[16px]",
            !searching && item.value === activeApp && "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--nexus-green)]"
          )}
          onClick={() => onSelectApp(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

// Renders selectable category pills for the active product tab.
function CategoryChips({
  activeCategory,
  categories,
  onSelectCategory,
}: {
  activeCategory: string
  categories: string[]
  onSelectCategory: (value: string) => void
}) {
  return (
    <div className="nexus-scrollbar mx-auto flex h-16 w-full max-w-[850px] items-center gap-2 overflow-x-auto px-6 py-6">
      {categories.map((item) => (
        <Button
          key={item}
          className={cn(
            "h-10 rounded-[32px] px-2 text-[12px] font-medium min-[760px]:px-5",
            item === activeCategory
              ? "border-[var(--nexus-green)] bg-[var(--nexus-green-soft)] text-[var(--nexus-green)] hover:bg-[var(--nexus-green-soft)]"
              : "border-[var(--nexus-border)] bg-white text-[var(--nexus-text)]"
          )}
          onClick={() => onSelectCategory(item)}
          variant="secondary"
        >
          {item}
        </Button>
      ))}
    </div>
  )
}

// Keeps the initial database request separate from the no-data state.
function LoadingState() {
  return (
    <section
      aria-label="Loading screens"
      className="mx-auto grid min-h-[420px] w-full max-w-[850px] grid-cols-1 gap-x-4 gap-y-8 px-6 pb-14 pt-10 min-[760px]:grid-cols-2"
      role="status"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div aria-hidden="true" className="min-w-0" key={index}>
          <div className="nexus-skeleton aspect-[2/3] w-full rounded-[32px]" />
          <div className="mt-4 flex min-h-[50px] items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="nexus-skeleton h-3 w-1/3 rounded-full" />
              <div className="nexus-skeleton h-4 w-3/4 rounded-full" />
            </div>
            <div className="nexus-skeleton h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </section>
  )
}

// Shows a calm empty state when there are no pushed records for the active product.
function EmptyState({ appName }: { appName: string }) {
  return (
    <section className="mx-auto flex min-h-[420px] w-full max-w-[850px] items-center justify-center px-6 pb-14 pt-10">
      <div className="max-w-[360px] text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-[18px] border border-dashed border-[var(--nexus-green)] bg-[var(--nexus-green-soft)] text-[var(--nexus-green)]">
          <Plus className="size-6" />
        </div>
        <h2 className="mt-5 text-[18px] font-semibold leading-6 text-[var(--nexus-text)]">
          No pushed screens yet
        </h2>
        <p className="mt-2 text-sm leading-5 text-[var(--nexus-caption)]">
          Select a frame in Figma, then push it to start the {appName} collection.
        </p>
      </div>
    </section>
  )
}

// Distinguishes an empty global search from an app with no pushed screens.
function SearchEmptyState({ query }: { query: string }) {
  return (
    <section className="mx-auto flex min-h-[420px] w-full max-w-[850px] items-center justify-center px-6 pb-14 pt-10">
      <div className="max-w-[360px] text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--nexus-preview)] text-[var(--nexus-caption)]">
          <Search className="size-6" />
        </div>
        <h2 className="mt-5 text-[18px] font-semibold leading-6 text-[var(--nexus-text)]">
          No screens found
        </h2>
        <p className="mt-2 text-sm leading-5 text-[var(--nexus-caption)]">
          No screens match &quot;{query.trim()}&quot; across all apps.
        </p>
      </div>
    </section>
  )
}

// Renders feature collections in small batches as the plugin viewport approaches the end.
function BrowseResults({
  features,
  onOpenFeature,
}: {
  features: FeatureCollection[]
  onOpenFeature: (feature: FeatureCollection) => void
}) {
  const { hasMore, limit, sentinelRef } = useProgressiveLimit(features.length, 6)

  return (
    <section
      aria-label="Feature results"
      className="mx-auto grid w-full max-w-[850px] grid-cols-1 gap-x-4 gap-y-8 px-6 pb-14 min-[760px]:grid-cols-2"
    >
      {features.slice(0, limit).map((item) => (
        <BrowseCard
          key={item.id}
          feature={item}
          onOpen={() => onOpenFeature(item)}
        />
      ))}
      {hasMore ? <LazyLoadSentinel sentinelRef={sentinelRef} /> : null}
    </section>
  )
}

// Renders individual screen cards for global search results instead of parent feature cards.
function SearchResults({
  onGoToScreen,
  onOpenDetail,
  screens,
}: {
  onGoToScreen: (item: GalleryItem) => void
  onOpenDetail: (item: GalleryItem) => void
  screens: NexusScreen[]
}) {
  const items = screens.map((screen) => getGalleryItem(screen))
  const { hasMore, limit, sentinelRef } = useProgressiveLimit(items.length, 12)

  return (
    <section
      aria-label="Screen search results"
      className="mx-auto grid w-full max-w-[850px] grid-cols-2 gap-4 px-6 pb-14 pt-4 md:grid-cols-3 min-[840px]:grid-cols-4 min-[840px]:px-8"
    >
      {items.slice(0, limit).map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          onGoToScreen={() => onGoToScreen(item)}
          onOpen={() => onOpenDetail(item)}
          onToggleSelected={() => undefined}
          selectable={false}
          selected={false}
        />
      ))}
      {hasMore ? <LazyLoadSentinel sentinelRef={sentinelRef} /> : null}
    </section>
  )
}

// Shows one feature card and opens the collection of screens stored beneath it.
function BrowseCard({ feature, onOpen }: { feature: FeatureCollection; onOpen: () => void }) {
  return (
    <article className="min-w-0">
      <button
        aria-label={`Open ${feature.featureName}`}
        className="flex aspect-[2/3] w-full items-start justify-center overflow-hidden rounded-[32px] bg-[var(--nexus-preview)] pt-6 transition hover:bg-[#dedede] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--nexus-green)]/20 min-[760px]:pt-8"
        onClick={onOpen}
        type="button"
      >
        {feature.previewImage ? (
          <span className="block aspect-[393/852] w-[62%] shrink-0 overflow-hidden rounded-[24px] bg-white">
            <LazyImage
              alt={feature.featureName}
              className="block size-full object-cover object-top transition-opacity duration-200"
              src={feature.previewImage}
            />
          </span>
        ) : null}
      </button>
      <div className="mt-4 flex min-h-[50px] items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs leading-5 text-[var(--nexus-caption)]">
            {feature.team}
          </p>
          <h2 className="truncate text-md font-medium leading-6 text-[var(--nexus-text)]">
            {feature.featureName}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--nexus-preview)] px-2 py-0.5 text-xs leading-5 text-[var(--nexus-caption)]">
          {feature.count}
        </span>
      </div>
    </article>
  )
}

// Displays the gallery heading, back button, and desktop breadcrumb metadata.
function GalleryTitleBar({
  feature,
  isDeleting,
  onBack,
  onDeleteSelected,
  selectedCount,
}: {
  feature: FeatureCollection
  isDeleting: boolean
  onBack: () => void
  onDeleteSelected: () => void
  selectedCount: number
}) {
  return (
    <section className="mx-auto grid min-h-16 w-full max-w-[850px] grid-cols-[48px_minmax(0,1fr)] items-center gap-2 px-6 pt-4 min-[760px]:grid-cols-[48px_minmax(0,1fr)_auto] min-[760px]:gap-[33px] min-[760px]:px-8">
      <Button
        aria-label="Back"
        onClick={onBack}
        size="icon-lg"
        variant="secondary"
      >
        <ArrowLeft className="size-5" />
      </Button>
      <h1 className="truncate text-[20px] font-semibold leading-[26px] text-black">
        {feature.featureName}
      </h1>
      {selectedCount > 0 ? (
        <Button
          aria-label={isDeleting ? "Deleting selected screens" : undefined}
          className={cn(
            "col-span-2 justify-self-end min-[760px]:col-span-1",
            isDeleting && pendingButtonClassName
          )}
          disabled={isDeleting}
          onClick={onDeleteSelected}
          variant="danger"
        >
          {isDeleting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="size-4" />
              Delete {selectedCount} {selectedCount === 1 ? "screen" : "screens"}
            </>
          )}
        </Button>
      ) : (
        <div className="hidden items-center gap-1 text-sm font-light min-[760px]:flex">
          <span className="text-[var(--nexus-inactive)]">{getAppLabel(feature.app)}</span>
          <span className="text-[var(--nexus-inactive)]">/</span>
          <strong className="text-[var(--nexus-text)]">{feature.team}</strong>
          <span className="text-[var(--nexus-inactive)]">/</span>
          <span className="rounded-full bg-[var(--nexus-preview)] px-2 text-sm leading-5 text-[var(--nexus-caption)]">
            {feature.count}
          </span>
        </div>
      )}
    </section>
  )
}

// Builds the preview grid for the selected screen collection.
function GalleryGrid({
  feature,
  onOpenDetail,
  onGoToScreen,
  onToggleScreen,
  selectedScreenIds,
}: {
  feature: FeatureCollection
  onOpenDetail: (item: GalleryItem) => void
  onGoToScreen: (item: GalleryItem) => void
  onToggleScreen: (screenId: string) => void
  selectedScreenIds: string[]
}) {
  const items = feature.screens.map((screen) => getGalleryItem(screen))
  const { hasMore, limit, sentinelRef } = useProgressiveLimit(items.length, 12)

  return (
    <section
      aria-label={`${feature.featureName} screens`}
      className="mx-auto grid w-full max-w-[850px] grid-cols-2 gap-4 px-6 pb-14 pt-4 md:grid-cols-3 min-[840px]:grid-cols-4 min-[840px]:px-8"
    >
      {items.slice(0, limit).map((item) => (
        <GalleryCard
          key={item.id}
          item={item}
          selected={selectedScreenIds.includes(item.screen.id)}
          onOpen={() => onOpenDetail(item)}
          onGoToScreen={() => onGoToScreen(item)}
          onToggleSelected={() => onToggleScreen(item.screen.id)}
        />
      ))}
      {hasMore ? <LazyLoadSentinel sentinelRef={sentinelRef} /> : null}
    </section>
  )
}

// Shows one gallery preview with hover actions for source navigation and detail view.
function GalleryCard({
  item,
  onGoToScreen,
  onOpen,
  onToggleSelected,
  selectable = true,
  selected,
}: {
  item: GalleryItem
  onGoToScreen: () => void
  onOpen: () => void
  onToggleSelected: () => void
  selectable?: boolean
  selected: boolean
}) {
  return (
    <article
      className={cn(
        "group relative aspect-[393/852] min-w-0 overflow-hidden rounded-[20px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg",
        selected ? "border-[var(--nexus-green)] ring-2 ring-[var(--nexus-green)]/20" : "border-[var(--nexus-border-strong)]"
      )}
    >
      {selectable ? (
        <Checkbox
          aria-label={`Select ${item.title}`}
          checked={selected}
          className={cn(
            "absolute left-3 top-3 z-20 transition-opacity has-[:focus-visible]:opacity-100",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onChange={onToggleSelected}
        />
      ) : null}
      <LazyImage
        alt={item.title}
        className="size-full object-cover object-top transition duration-200 group-hover:scale-[1.015]"
        src={item.thumbnail}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 translate-y-3 rounded-[16px] border border-[var(--nexus-border)] bg-white/95 p-3 opacity-0 shadow-xl backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
        <p className="truncate text-[10px] leading-[14px] text-[var(--nexus-caption)]">
          {item.screen.platform}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-[18px] text-[var(--nexus-text)]">
          {item.title}
        </p>
        <div className="pointer-events-auto mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="text-[12px] font-medium"
            onClick={onGoToScreen}
          >
            Open screen
          </Button>
          <Button size="sm" variant="primary" className="text-[12px]" onClick={onOpen}>
            View
          </Button>
        </div>
      </div>
    </article>
  )
}

// Renders the full-screen bulk form and derives one editable row per selected Figma frame.
function PushDesignScreen({
  editRecord,
  initialApp,
  onClose,
  records,
  selectedNodes,
}: {
  editRecord?: ScreenRecord
  initialApp: string
  onClose: () => void
  records: ScreenRecord[]
  selectedNodes: SelectionNodeSummary[]
}) {
  const isEditMode = Boolean(editRecord)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null | undefined>(undefined)
  const [screenNames, setScreenNames] = useState<Record<string, string>>({})
  const [selectedApp, setSelectedApp] = useState(
    editRecord ? getAppLabel(appLabelToSlug(editRecord.app)) : initialApp
  )
  const [selectedFeature, setSelectedFeature] = useState(editRecord?.featureName || "")
  const [selectedTeam, setSelectedTeam] = useState(editRecord?.team || "")
  const [sourceUrls, setSourceUrls] = useState<Record<string, string>>({})
  const [screenTags, setScreenTags] = useState<Record<string, string[]>>({})
  const [editScreenName, setEditScreenName] = useState(editRecord?.screenName || "")
  const [editTags, setEditTags] = useState(editRecord?.tags || [])
  const [replaceSource, setReplaceSource] = useState(false)
  const [keepInformationArchitecture, setKeepInformationArchitecture] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
      if (
        event.data.pluginMessage?.type === "push-screens-failed"
        || event.data.pluginMessage?.type === "record-update-failed"
      ) {
        setIsSubmitting(false)
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const teamOptions = useMemo(
    () => getUniqueOptions(
      records
        .filter((record) => appLabelToSlug(record.app) === appLabelToSlug(selectedApp))
        .map((record) => record.team)
    ),
    [records, selectedApp]
  )
  const featureOptions = useMemo(
    () => getUniqueOptions(
      records
        .filter((record) => {
          const matchesApp = appLabelToSlug(record.app) === appLabelToSlug(selectedApp)
          const matchesTeam = !selectedTeam.trim()
            || record.team.trim().toLowerCase() === selectedTeam.trim().toLowerCase()

          return matchesApp && matchesTeam
        })
        .map((record) => record.featureName)
    ),
    [records, selectedApp, selectedTeam]
  )
  const tagOptions = useMemo(
    () => getUniqueOptions([
      ...records.flatMap((record) => record.tags || []),
      ...Object.values(screenTags).flat(),
      ...editTags,
    ]),
    [editTags, records, screenTags]
  )
  const activeExpandedNodeId = expandedNodeId === undefined
    ? selectedNodes[0]?.id
    : expandedNodeId && selectedNodes.some((node) => node.id === expandedNodeId)
      ? expandedNodeId
      : expandedNodeId === null
        ? null
        : selectedNodes[0]?.id
  const screenDrafts = selectedNodes.map((node) => ({
    ...node,
    screenName: screenNames[node.id] ?? node.name,
    sourceUrl: sourceUrls[node.id] ?? node.url ?? "",
    tags: screenTags[node.id] ?? [],
  }))
  const hasMissingUrl = screenDrafts.some((screen) => !screen.sourceUrl.trim())
  const hasMissingMetadata = !selectedApp || !selectedTeam.trim() || !selectedFeature.trim()
  const replacementNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined
  const replacementSourceUrl = replacementNode?.url || ""
  const canEdit = Boolean(
    editRecord
    && editScreenName.trim()
    && !hasMissingMetadata
    && (!replaceSource || (replacementNode && replacementSourceUrl.trim()))
  )
  const canSubmit = isEditMode
    ? canEdit
    : screenDrafts.length > 0 && !hasMissingUrl && !hasMissingMetadata

  return (
    <form
      aria-busy={isSubmitting}
      className="flex h-screen min-h-0 flex-col bg-[var(--nexus-background)] text-[var(--nexus-text)]"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit || isSubmitting) return

        setIsSubmitting(true)
        if (editRecord) {
          post({
            app: selectedApp,
            featureName: selectedFeature.trim(),
            recordId: editRecord.id,
            replacement: replaceSource && replacementNode
              ? {
                keepInformationArchitecture,
                nodeId: replacementNode.id,
                sourceUrl: replacementSourceUrl,
              }
              : undefined,
            screenName: editScreenName.trim(),
            tags: editTags,
            team: selectedTeam.trim(),
            type: "update-record",
          })
          return
        }

        post({
          app: selectedApp,
          featureName: selectedFeature.trim(),
          screens: screenDrafts.map((screen) => ({
            nodeId: screen.id,
            screenName: screen.screenName.trim() || screen.name,
            sourceUrl: screen.sourceUrl.trim(),
            tags: screen.tags,
          })),
          team: selectedTeam.trim(),
          type: "push-screens",
        })
      }}
    >
      <header className="flex h-[64px] shrink-0 items-center gap-4 border-b border-[var(--nexus-border)] bg-white px-6">
        <Button
          aria-label="Back"
          disabled={isSubmitting}
          onClick={onClose}
          size="icon-lg"
          variant="secondary"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="truncate text-[16px] font-semibold leading-9">
          {editRecord ? `Edit “${editRecord.screenName}”` : "Push your Design"}
        </h1>
      </header>

      <div className="nexus-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
        <section className="mx-auto min-h-full w-full max-w-[802px] rounded-[16px] bg-white px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto flex w-full max-w-[631px] flex-col gap-6">
            <ChipField
              label="Select your app"
              options={appOptions}
              value={selectedApp}
              onChange={setSelectedApp}
            />

            <AutocompleteField
              label="Select your team"
              options={teamOptions}
              placeholder="Select or add a team"
              value={selectedTeam}
              onChange={setSelectedTeam}
            />

            <AutocompleteField
              label="Select your feature"
              options={featureOptions}
              placeholder="Select or add a feature"
              value={selectedFeature}
              onChange={setSelectedFeature}
            />

            <div className="border-t border-dashed border-[var(--nexus-border)] pt-6">
              {editRecord ? (
                <EditScreenFields
                  currentSourceUrl={getScreenSourceUrl(editRecord) || ""}
                  keepInformationArchitecture={keepInformationArchitecture}
                  onKeepInformationArchitectureChange={setKeepInformationArchitecture}
                  onReplaceSourceChange={setReplaceSource}
                  onScreenNameChange={setEditScreenName}
                  onTagsChange={setEditTags}
                  replaceSource={replaceSource}
                  replacementNode={replacementNode}
                  screenName={editScreenName}
                  selectionCount={selectedNodes.length}
                  tagOptions={tagOptions}
                  tags={editTags}
                />
              ) : screenDrafts.length === 0 ? (
                <div className="flex h-24 items-center gap-3 rounded-[16px] border border-dashed border-[var(--nexus-border-strong)] bg-[var(--nexus-muted)] px-5 text-base text-[var(--nexus-inactive)]">
                  <Plus className="size-5" />
                  <span>Select frame / canvas</span>
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex min-h-7 items-center rounded-full bg-[#f0f5ff] px-4 py-1 text-sm leading-5 text-[#265fd4]">
                    <strong>{screenDrafts.length} {screenDrafts.length === 1 ? "screen" : "screens"}</strong>
                    <span>&nbsp;detected</span>
                  </div>

                  <div className="flex flex-col">
                    {screenDrafts.map((screen) => (
                      <BulkPushScreenRow
                        key={screen.id}
                        expanded={activeExpandedNodeId === screen.id}
                        screen={screen}
                        onRemove={() => post({ nodeId: screen.id, type: "remove-selection-node" })}
                        onScreenNameChange={(value) => {
                          setScreenNames((current) => ({ ...current, [screen.id]: value }))
                        }}
                        onSourceUrlChange={(value) => {
                          setSourceUrls((current) => ({
                            ...current,
                            ...Object.fromEntries(
                              selectedNodes.map((node) => [
                                node.id,
                                addNodeIdToSourceUrl(value, node.id),
                              ])
                            ),
                          }))
                        }}
                        onTagsChange={(tags) => {
                          setScreenTags((current) => ({ ...current, [screen.id]: tags }))
                        }}
                        tagOptions={tagOptions}
                        onToggle={() => {
                          setExpandedNodeId((current) => current === screen.id ? null : screen.id)
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="flex h-[72px] shrink-0 items-center justify-end gap-4 border-t border-[var(--nexus-border)] bg-white px-8 py-6">
        <Button disabled={isSubmitting} onClick={onClose} variant="secondary">
          Cancel
        </Button>
        <Button
          aria-label={isSubmitting
            ? editRecord ? "Updating screen" : "Uploading screens"
            : undefined}
          className={cn(isSubmitting && pendingButtonClassName)}
          disabled={!canSubmit || isSubmitting}
          type="submit"
          variant="primary"
        >
          {isSubmitting ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : editRecord ? "Update" : "Submit"}
        </Button>
      </footer>
    </form>
  )
}

// Edits one saved screen while keeping source replacement explicitly optional.
function EditScreenFields({
  currentSourceUrl,
  keepInformationArchitecture,
  onKeepInformationArchitectureChange,
  onReplaceSourceChange,
  onScreenNameChange,
  onTagsChange,
  replaceSource,
  replacementNode,
  screenName,
  selectionCount,
  tagOptions,
  tags,
}: {
  currentSourceUrl: string
  keepInformationArchitecture: boolean
  onKeepInformationArchitectureChange: (value: boolean) => void
  onReplaceSourceChange: (value: boolean) => void
  onScreenNameChange: (value: string) => void
  onTagsChange: (tags: string[]) => void
  replaceSource: boolean
  replacementNode?: SelectionNodeSummary
  screenName: string
  selectionCount: number
  tagOptions: string[]
  tags: string[]
}) {
  const selectionMessage = selectionCount === 0
    ? "Select one frame, component, or instance in Figma."
    : selectionCount > 1
      ? "Select only one screen to use as the new source."
      : replacementNode?.name || "Selected screen"

  return (
    <div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className={formLabelClassName}>Screen name</span>
          <div className="relative">
            <PencilLine
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#bfbfbf]"
            />
            <Input
              aria-label="Screen name"
              className="h-10 rounded-[12px] bg-[var(--nexus-muted)] pl-11 pr-3 text-[13px] font-medium"
              value={screenName}
              onChange={(event) => onScreenNameChange(event.currentTarget.value)}
            />
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className={formLabelClassName}>Current Figma URL</span>
          <div className="relative">
            <FigmaLogo className="pointer-events-none absolute left-3 top-1/2 h-4 w-3 -translate-y-1/2 text-[var(--nexus-inactive)]" />
            <Input
              aria-label="Current Figma URL"
              className="h-10 cursor-not-allowed rounded-[12px] bg-[#f3f3f3] pl-11 pr-3 text-[13px] text-[var(--nexus-inactive)] opacity-70"
              disabled
              value={currentSourceUrl}
            />
          </div>
        </label>

        <HashtagField
          label={`Hashtags for ${screenName || "screen"}`}
          onChange={onTagsChange}
          options={tagOptions}
          value={tags}
        />

        <ToggleField
          checked={replaceSource}
          description="Use one selected Figma screen as the new image and source URL."
          label="Replace Figma source"
          onCheckedChange={onReplaceSourceChange}
        />

        {replaceSource ? (
          <div className="flex flex-col gap-4 rounded-[12px] border border-[var(--nexus-border)] bg-[var(--nexus-muted)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--nexus-text)]">Selected Figma screen</p>
              <p className={cn(
                "mt-1 text-xs leading-5",
                replacementNode && selectionCount === 1
                  ? "text-[var(--nexus-caption)]"
                  : "text-[var(--nexus-error)]"
              )}>
                {selectionMessage}
              </p>
            </div>

            {replacementNode && selectionCount === 1 ? (
              <div className="relative">
                <FigmaLogo className="pointer-events-none absolute left-3 top-1/2 h-4 w-3 -translate-y-1/2 text-[var(--nexus-caption)]" />
                <Input
                  aria-label="New Figma URL"
                  className="h-10 rounded-[12px] bg-white pl-11 pr-3 text-[13px] text-[#265fd4]"
                  readOnly
                  value={replacementNode.url || ""}
                />
              </div>
            ) : null}

            <ToggleField
              checked={keepInformationArchitecture}
              description={keepInformationArchitecture
                ? "Keep the IA already saved in the database."
                : "Generate a new IA from the selected Figma screen."
              }
              label={keepInformationArchitecture ? "Keep existing IA" : "Generate new IA"}
              onCheckedChange={onKeepInformationArchitectureChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Shared binary control for edit-mode source and IA options.
function ToggleField({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean
  description: string
  label: string
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] border border-[var(--nexus-border)] bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5 text-[var(--nexus-text)]">{label}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--nexus-caption)]">{description}</p>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

// Renders one expandable selected-screen row with editable name, URL, and removal action.
function BulkPushScreenRow({
  expanded,
  onRemove,
  onScreenNameChange,
  onSourceUrlChange,
  onTagsChange,
  onToggle,
  screen,
  tagOptions,
}: {
  expanded: boolean
  onRemove: () => void
  onScreenNameChange: (value: string) => void
  onSourceUrlChange: (value: string) => void
  onToggle: () => void
  onTagsChange: (tags: string[]) => void
  screen: SelectionNodeSummary & { screenName: string; sourceUrl: string; tags: string[] }
  tagOptions: string[]
}) {
  const [isCopied, setIsCopied] = useState(false)

  const copyTags = async () => {
    if (screen.tags.length === 0) return

    const copiedTags = screen.tags.map((tag) => `#${tag}`).join(" ")

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copiedTags)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = copiedTags
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        textarea.remove()
      }
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 1600)
    } catch {
      setIsCopied(false)
    }
  }

  return (
    <article className="border-b border-dashed border-[var(--nexus-border)] py-4 first:pt-2">
      <div className="grid grid-cols-[24px_minmax(0,1fr)_40px] items-center gap-4">
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${screen.screenName}`}
          className="flex size-6 items-center justify-center rounded text-[var(--nexus-caption)] outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[var(--nexus-green)]/20"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown className={cn("size-5 transition", expanded && "rotate-180")} />
        </button>
        <div className="relative">
          <PencilLine
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#bfbfbf]"
          />
          <Input
            aria-label={`Screen name for ${screen.name}`}
            className="h-10 rounded-[12px] bg-[var(--nexus-muted)] pl-11 pr-3 text-[13px] font-medium"
            value={screen.screenName}
            onChange={(event) => onScreenNameChange(event.currentTarget.value)}
          />
        </div>
        <Button
          aria-label={`Remove ${screen.screenName}`}
          onClick={onRemove}
          size="icon"
          variant="icon"
        >
          <Trash2 className="size-5" />
        </Button>
      </div>

      {expanded ? (
        <div className="ml-10 mr-14 mt-2">
          <div className="relative">
            <FigmaLogo className="pointer-events-none absolute left-3 top-1/2 h-4 w-3 -translate-y-1/2 text-[var(--nexus-caption)]" />
            <Input
              aria-label={`Figma URL for ${screen.screenName}`}
              className={cn(
                "h-10 rounded-[12px] bg-[var(--nexus-muted)] pl-11 pr-3 text-[13px] text-[#265fd4]",
                !screen.sourceUrl && "border-[var(--nexus-error)]"
              )}
              placeholder="Paste the current Figma file URL"
              type="url"
              value={screen.sourceUrl}
              onChange={(event) => onSourceUrlChange(event.currentTarget.value)}
            />
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <HashtagField
                label={`Hashtags for ${screen.screenName}`}
                onChange={onTagsChange}
                options={tagOptions}
                value={screen.tags}
              />
            </div>
            <Button
              aria-label={`Copy hashtags for ${screen.screenName}`}
              className="mt-2 shrink-0"
              disabled={screen.tags.length === 0}
              onClick={copyTags}
              size="icon"
              title="Copy hashtags"
              variant="icon"
            >
              {isCopied ? <Check className="size-5" /> : <Copy className="size-5" />}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

// Reusable selectable pill group used inside the push-design form.
function ChipField({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className={cn(formLabelClassName, "mb-3")}>
        {label}
      </legend>
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {options.map((item) => (
          <Button
            key={item}
            className={cn(
              formPillValueClassName,
              item === value &&
              "h-10 border-[var(--nexus-green)] bg-[var(--nexus-green-soft)] font-medium text-[var(--nexus-green)] hover:bg-[var(--nexus-green-soft)]"
            )}
            onClick={() => onChange(item)}
            variant="secondary"
          >
            {item}
          </Button>
        ))}
      </div>
    </fieldset>
  )
}

// Renders a shadcn-style editable combobox with history suggestions and custom values.
function AutocompleteField({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  value: string
}) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const trimmedValue = value.trim()
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(trimmedValue.toLowerCase())
  )
  const hasExactMatch = options.some(
    (option) => option.toLowerCase() === trimmedValue.toLowerCase()
  )
  const selectableItems = hasExactMatch || !trimmedValue
    ? filteredOptions
    : [...filteredOptions, trimmedValue]
  const resolvedActiveIndex = activeIndex >= 0 && activeIndex < selectableItems.length
    ? activeIndex
    : -1

  useEffect(() => {
    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside)
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside)
  }, [])

  // Applies a history suggestion or confirms a newly typed value.
  const selectValue = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <label className="flex flex-col gap-3">
      <span className={formLabelClassName}>{label}</span>
      <div className="relative" ref={rootRef}>
        <Input
          aria-activedescendant={resolvedActiveIndex >= 0 ? `${listboxId}-${resolvedActiveIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          className="pr-12"
          placeholder={placeholder}
          role="combobox"
          value={value}
          onChange={(event) => {
            setActiveIndex(-1)
            onChange(event.currentTarget.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => Math.min(current + 1, selectableItems.length - 1))
            }

            if (event.key === "ArrowUp") {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => Math.max(current - 1, 0))
            }

            if (event.key === "Enter" && open) {
              event.preventDefault()
              if (resolvedActiveIndex >= 0 && selectableItems[resolvedActiveIndex]) {
                selectValue(selectableItems[resolvedActiveIndex])
              } else if (trimmedValue) {
                selectValue(trimmedValue)
              }
            }

            if (event.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        <Button
          aria-label={`Toggle ${label.toLowerCase()} options`}
          aria-expanded={open}
          className="absolute right-1 top-1/2 size-10 -translate-y-1/2 rounded-[12px] bg-transparent active:-translate-y-1/2"
          onClick={() => setOpen((current) => !current)}
          size="icon"
          variant="ghost"
        >
          <ChevronDown className={cn("size-5 transition", open && "rotate-180")} />
        </Button>

        {open && selectableItems.length > 0 ? (
          <div
            className="nexus-scrollbar absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-52 overflow-y-auto rounded-[12px] border border-[var(--nexus-border)] bg-white p-1.5 shadow-xl"
            id={listboxId}
            role="listbox"
          >
            {selectableItems.map((option, index) => {
              const isNewOption = option === trimmedValue && !hasExactMatch

              return (
                <button
                  aria-selected={option.toLowerCase() === trimmedValue.toLowerCase()}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm text-[var(--nexus-text)] outline-none transition hover:bg-[var(--nexus-muted)] focus:bg-[var(--nexus-muted)]",
                    resolvedActiveIndex === index && "bg-[var(--nexus-muted)]"
                  )}
                  id={`${listboxId}-${index}`}
                  key={`${option}-${index}`}
                  onClick={() => selectValue(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  {isNewOption ? <Plus className="size-4 text-[var(--nexus-green)]" /> : null}
                  <span className="truncate">
                    {isNewOption ? `Add \"${option}\"` : option}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </label>
  )
}

// Renders removable hashtags with autocomplete suggestions from previously saved records.
function HashtagField({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (tags: string[]) => void
  options: string[]
  value: string[]
}) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const normalizedInput = normalizeHashtag(inputValue)
  const selectedTags = new Set(value.map((tag) => tag.toLowerCase()))
  const filteredOptions = options.filter((option) => (
    !selectedTags.has(option.toLowerCase())
    && (!normalizedInput || option.toLowerCase().includes(normalizedInput.toLowerCase()))
  ))
  const hasExactMatch = value.some((tag) => tag.toLowerCase() === normalizedInput.toLowerCase())
  const selectableItems = normalizedInput && !hasExactMatch
    ? [...filteredOptions, normalizedInput]
    : filteredOptions
  const resolvedActiveIndex = activeIndex >= 0 && activeIndex < selectableItems.length
    ? activeIndex
    : -1

  useEffect(() => {
    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside)
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside)
  }, [])

  const addTags = (rawTags: string[]) => {
    const nextTags = [...value]
    rawTags.map(normalizeHashtag).filter(Boolean).forEach((tag) => {
      if (!nextTags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        nextTags.push(tag)
      }
    })

    if (nextTags.length !== value.length) {
      onChange(nextTags)
    }
    setInputValue("")
    setActiveIndex(-1)
    setOpen(false)
  }

  const addTag = (rawTag: string) => addTags([rawTag])

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  return (
    <label className="mt-2 flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      <div className="relative" ref={rootRef}>
        <div
          className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[12px] border border-[var(--nexus-border)] bg-[var(--nexus-muted)] px-2 py-1.5 transition focus-within:border-[var(--nexus-green)] focus-within:ring-2 focus-within:ring-[var(--nexus-green)]/10"
          onClick={() => setOpen(true)}
        >
          {value.map((tag) => (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--nexus-border)] bg-white py-1 pl-2.5 pr-1 text-[12px] font-medium text-[var(--nexus-green)]"
              key={tag}
            >
              <span className="truncate">#{tag}</span>
              <button
                aria-label={`Remove #${tag}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-full outline-none transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-[var(--nexus-green)]/30"
                onClick={(event) => {
                  event.stopPropagation()
                  removeTag(tag)
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <input
            aria-activedescendant={resolvedActiveIndex >= 0 ? `${listboxId}-${resolvedActiveIndex}` : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-label={label}
            className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-[13px] text-[var(--nexus-text)] outline-none placeholder:text-[var(--nexus-inactive)]"
            placeholder={value.length > 0 ? "Add another hashtag" : "Add hashtags"}
            role="combobox"
            value={inputValue}
            onChange={(event) => {
              setActiveIndex(-1)
              setInputValue(event.currentTarget.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onPaste={(event) => {
              const pastedTags = parseHashtags(event.clipboardData.getData("text"))
              if (pastedTags.length === 0) return

              event.preventDefault()
              addTags(pastedTags)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setOpen(true)
                setActiveIndex((current) => Math.min(current + 1, selectableItems.length - 1))
              }

              if (event.key === "ArrowUp") {
                event.preventDefault()
                setOpen(true)
                setActiveIndex((current) => Math.max(current - 1, 0))
              }

              if ((event.key === "Enter" || event.key === ",") && open) {
                event.preventDefault()
                addTag(resolvedActiveIndex >= 0
                  ? selectableItems[resolvedActiveIndex]
                  : inputValue)
              }

              if (event.key === "Backspace" && !inputValue && value.length > 0) {
                removeTag(value[value.length - 1])
              }

              if (event.key === "Escape") {
                setOpen(false)
              }
            }}
          />
        </div>

        {open && selectableItems.length > 0 ? (
          <div
            className="nexus-scrollbar absolute bottom-[calc(100%+8px)] left-0 right-0 z-30 max-h-52 overflow-y-auto rounded-[12px] border border-[var(--nexus-border)] bg-white p-1.5 shadow-xl"
            id={listboxId}
            role="listbox"
          >
            {selectableItems.map((option, index) => {
              const isNewOption = option === normalizedInput && !options.some(
                (item) => item.toLowerCase() === normalizedInput.toLowerCase()
              )

              return (
                <button
                  aria-selected={resolvedActiveIndex === index}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-sm text-[var(--nexus-text)] outline-none transition hover:bg-[var(--nexus-muted)] focus:bg-[var(--nexus-muted)]",
                    resolvedActiveIndex === index && "bg-[var(--nexus-muted)]"
                  )}
                  id={`${listboxId}-${index}`}
                  key={`${option}-${index}`}
                  onClick={() => addTag(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  {isNewOption ? <Plus className="size-4 text-[var(--nexus-green)]" /> : null}
                  <span className="truncate">
                    {isNewOption ? `Add #${option}` : `#${option}`}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function normalizeHashtag(value: string) {
  return value.replace(/^#+/, "").trim().replace(/\s+/g, "-")
}

function parseHashtags(value: string) {
  return value.split(/[\s,]+/).map(normalizeHashtag).filter(Boolean)
}

// Normalizes stored metadata into a sorted list of unique autocomplete options.
function getUniqueOptions(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))
}

// Renders the detailed screen preview modal with navigation and canvas actions.
function DetailDialog({
  isDeleting,
  item,
  onClose,
  onDelete,
  onEdit,
  onNext,
  onPrevious,
  onGoToScreen,
}: {
  isDeleting: boolean
  item: GalleryItem
  onClose: () => void
  onDelete: () => void
  onEdit: () => void
  onNext: () => void
  onPrevious: () => void
  onGoToScreen: () => void
}) {
  const [showInformationArchitecture, setShowInformationArchitecture] = useState(false)
  const authorName = item.record?.createdByName || "Unknown designer"
  const updatedAt = item.record?.updatedAt ? formatDisplayDate(item.record.updatedAt) : "Unknown date"
  const informationArchitecture = item.record
    ? item.record.informationArchitecture?.version === 10
      ? item.record.informationArchitecture
      : generateInformationArchitecture(
        item.record.screenName,
        item.record.nodeSnapshot,
        item.record.updatedAt
      )
    : null
  const detailStats = [
    ["Opens", item.opens],
    ["Size", item.size],
    ["Views", item.views],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-white">
        <div className="relative mx-auto flex h-screen w-full max-w-[800px] flex-col overflow-hidden bg-white">
          <Button
            aria-label="Previous screen"
            className="absolute left-4 top-[42%] z-30 bg-[var(--nexus-preview)] text-[var(--nexus-caption)] hover:bg-[#dadada]"
            onClick={onPrevious}
            size="icon"
            variant="icon"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            aria-label="Next screen"
            className="absolute right-4 top-[42%] z-30 bg-[var(--nexus-preview)] text-[var(--nexus-caption)] hover:bg-[#dadada]"
            onClick={onNext}
            size="icon"
            variant="icon"
          >
            <ArrowRight className="size-5" />
          </Button>

          <section
            aria-labelledby="screen-detail-title"
            aria-modal="true"
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
            role="dialog"
          >
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--nexus-border)] bg-[var(--nexus-muted)] pl-5 pr-3 sm:pl-8 sm:pr-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#a6e8ff] text-base font-medium text-[var(--nexus-text)]">
                  {getNameInitial(authorName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-6 text-[var(--nexus-text)]">
                    {authorName}
                  </p>
                  <p className="truncate text-xs leading-4 text-[var(--nexus-caption)]">
                    Last Update : {updatedAt}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <dl className="mr-6 hidden grid-cols-[72px_72px_72px] gap-2 text-right min-[640px]:grid">
                  {detailStats.map(([label, value]) => (
                    <div key={label} className="w-[72px]">
                      <dt className="text-xs leading-3 text-[var(--nexus-caption)]">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium leading-4 text-[var(--nexus-text)] tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Button aria-label="Close detail" onClick={onClose} size="icon" variant="icon">
                  <X className="size-5" />
                </Button>
              </div>
            </div>

            <div className="nexus-scrollbar flex min-h-0 flex-1 justify-center overflow-y-auto bg-white px-12 py-8">
              <div className="h-max w-[min(393px,calc(100vw-96px))] shrink-0 overflow-hidden rounded-[32px] border border-[#bfbfbf] bg-white">
                <img
                  alt={item.title}
                  className="block h-auto w-full"
                  decoding="async"
                  loading="eager"
                  src={item.detailImage}
                />
              </div>
            </div>
          </section>

          <section className="relative shrink-0 border-t border-[var(--nexus-border)] bg-white p-5 shadow-[0_-12px_28px_rgba(0,0,0,0.08)] sm:flex sm:items-start sm:justify-between sm:gap-6 sm:p-6">
            <div className="absolute bottom-full right-4 z-30 mb-3 flex flex-col gap-3">
              <Button
                aria-label="Open screen in Figma"
                className="bg-[var(--nexus-preview)] bg-neutral-900 text-[var(--nexus-caption)] hover:bg-neutral-700"
                onClick={onGoToScreen}
                size="icon"
                title="Open screen in Figma"
                variant="icon"
              >
                <FigmaLogo className="h-5 w-5 text-white" />
              </Button>
              <Button
                aria-label="Edit screen"
                className="bg-[var(--nexus-preview)] text-[var(--nexus-caption)] hover:bg-[#dadada]"
                disabled={isDeleting}
                onClick={onEdit}
                size="icon"
                title="Edit screen"
                variant="icon"
              >
                <PencilLine className="size-5" />
              </Button>
              <Button
                aria-label={isDeleting ? "Deleting screen" : "Delete screen"}
                className={cn(
                  "bg-[var(--nexus-preview)] text-[var(--nexus-error)] hover:bg-[#fff5f7]",
                  isDeleting && pendingButtonClassName
                )}
                disabled={isDeleting}
                onClick={onDelete}
                size="icon"
                title="Delete screen"
                variant="icon"
              >
                {isDeleting ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <Trash2 className="size-5" />
                )}
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 text-xs leading-5">
                <span className="font-light text-[var(--nexus-inactive)]">
                  {getAppLabel(item.screen.app)}
                </span>
                <span className=" font-light text-[var(--nexus-inactive)]">/</span>
                <span className="font-light text-[var(--nexus-inactive)]">
                  {item.screen.category}
                </span>
                <span className="font-light text-[var(--nexus-inactive)]">/</span>
                <span className="font-light text-[var(--nexus-inactive)]">
                  {item.screen.platform}
                </span>
              </div>
              <h2
                className="mt-2 max-w-[395px] text-[16px] font-semibold leading-6 text-[var(--nexus-text)]"
                id="screen-detail-title"
              >
                {item.title}
              </h2>
              {item.record?.tags?.length ? (
                <div aria-label="Screen hashtags" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.record.tags.map((tag) => (
                    <span
                      className="text-xs font-light text-[var(--nexus-inactive)]"
                      key={tag}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-5 shrink-0 sm:mt-0">
              <Button
                aria-label="Show information architecture"
                className="gap-2 px-3"
                disabled={!informationArchitecture}
                onClick={() => setShowInformationArchitecture(true)}
                variant="secondary"
              >
                {/* <ListTree className="size-4" /> */}
                Show IA
              </Button>
            </div>
          </section>
        </div>
      </div>

      {showInformationArchitecture && informationArchitecture ? (
        <InformationArchitectureDialog
          informationArchitecture={informationArchitecture}
          recordId={item.record?.id}
          screenName={item.title}
          onClose={() => setShowInformationArchitecture(false)}
        />
      ) : null}
    </>
  )
}

// Displays the generated IA as a focused modal above the screen detail view.
function InformationArchitectureDialog({
  informationArchitecture,
  onClose,
  recordId,
  screenName,
}: {
  informationArchitecture: ScreenInformationArchitecture
  onClose: () => void
  recordId?: string
  screenName: string
}) {
  const [draftInformationArchitecture, setDraftInformationArchitecture] = useState(informationArchitecture)
  const [activeView, setActiveView] = useState<"tree" | "text">("tree")
  const [savedSignature, setSavedSignature] = useState(() => (
    getInformationArchitectureEditSignature(informationArchitecture)
  ))
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const draftSignature = useMemo(
    () => getInformationArchitectureEditSignature(draftInformationArchitecture),
    [draftInformationArchitecture]
  )
  const isDirty = draftSignature !== savedSignature

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
      const message = event.data.pluginMessage
      if (
        !message
        || (
          message.type !== "information-architecture-saved"
          && message.type !== "information-architecture-save-failed"
        )
        || message.recordId !== recordId
      ) return

      if (message.type === "information-architecture-saved") {
        setSavedSignature(pendingSignature || draftSignature)
        setPendingSignature(null)
        setIsSaving(false)
      }

      if (message.type === "information-architecture-save-failed") {
        setPendingSignature(null)
        setIsSaving(false)
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [draftSignature, pendingSignature, recordId])

  // Recalculates IA counts and sequence numbers after one tree edit.
  const updateRegions = (regions: InformationArchitectureNode[]) => {
    setDraftInformationArchitecture((current) => {
      const next = rebuildEditableInformationArchitecture(current, regions)
      return {
        ...next,
        freeformText: informationArchitectureToBulletList(next.regions),
      }
    })
  }

  const updateFreeformText = (value: string) => {
    const parsedText = normalizeInformationArchitectureBulletList(value)
    setDraftInformationArchitecture((current) => {
      const next = rebuildEditableInformationArchitecture(
        { ...current, freeformText: value },
        parseInformationArchitectureBulletList(parsedText)
      )
      return { ...next, freeformText: value }
    })
  }

  const changeView = (nextView: "tree" | "text") => {
    if (nextView === "tree") {
      const currentText = draftInformationArchitecture.freeformText
        ?? informationArchitectureToBulletList(draftInformationArchitecture.regions)
      const normalizedText = normalizeInformationArchitectureBulletList(currentText)
      if (currentText !== normalizedText) {
        setDraftInformationArchitecture((current) => {
          const next = rebuildEditableInformationArchitecture(
            { ...current, freeformText: normalizedText },
            parseInformationArchitectureBulletList(normalizedText)
          )
          return { ...next, freeformText: normalizedText }
        })
      }
    }
    setActiveView(nextView)
  }

  // Saves the complete edited tree back onto the current screen record.
  const saveInformationArchitecture = () => {
    if (!recordId || !isDirty || isSaving) return
    const normalizedText = draftInformationArchitecture.freeformText === undefined
      ? undefined
      : normalizeInformationArchitectureBulletList(draftInformationArchitecture.freeformText)
    const nextInformationArchitecture = normalizedText === undefined
      ? draftInformationArchitecture
      : {
        ...rebuildEditableInformationArchitecture(
          { ...draftInformationArchitecture, freeformText: normalizedText },
          parseInformationArchitectureBulletList(normalizedText)
        ),
        freeformText: normalizedText,
      }
    setIsSaving(true)
    setDraftInformationArchitecture(nextInformationArchitecture)
    setPendingSignature(getInformationArchitectureEditSignature(nextInformationArchitecture))
    post({
      informationArchitecture: nextInformationArchitecture,
      recordId,
      type: "update-information-architecture",
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-5"
      onMouseDown={onClose}
    >
      <section
        aria-labelledby="information-architecture-title"
        aria-modal="true"
        className="flex h-[calc(100vh-40px)] max-h-[808px] w-full max-w-[708px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[var(--nexus-border)] px-8">
          <div className="min-w-0">
            <p className="text-sm leading-5 text-[var(--nexus-caption)]">Information Architecture</p>
            <h2
              className="truncate text-[16px] font-semibold leading-9"
              id="information-architecture-title"
            >
              {screenName}
            </h2>
          </div>
          <Button
            aria-label="Close information architecture"
            onClick={onClose}
            size="icon"
            variant="icon"
          >
            <X className="size-5" />
          </Button>
        </header>

        <div className="relative z-20 h-0">
          <div
            aria-label="Information architecture view"
            className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--nexus-border)] bg-white p-1 shadow-lg"
            role="tablist"
          >
            {[
              { icon: HierarchySquare01Icon, label: "Tree", value: "tree" },
              { icon: TextSquareIcon, label: "Text", value: "text" },
            ].map(({ icon, label, value }) => (
              <button
                aria-selected={activeView === value}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
                  activeView === value
                    ? "bg-[var(--nexus-green-soft)] text-[var(--nexus-green)]"
                    : "text-[var(--nexus-caption)] hover:bg-[var(--nexus-muted)]"
                )}
                key={value}
                onClick={() => changeView(value as "tree" | "text")}
                role="tab"
                type="button"
              >
                <HugeiconsIcon aria-hidden="true" icon={icon} size={16} strokeWidth={1.8} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn(
          "nexus-scrollbar min-h-0 flex-1 overflow-auto bg-white px-8 pb-8 pt-20",
          isSaving && "pointer-events-none"
        )}>
          {activeView === "tree" ? (
            <InformationArchitectureGraph
              informationArchitecture={draftInformationArchitecture}
              onChange={updateRegions}
              screenName={screenName}
            />
          ) : (
            <InformationArchitectureTextEditor
              informationArchitecture={draftInformationArchitecture}
              onChange={updateFreeformText}
            />
          )}
        </div>

        <footer className="flex h-[64px] shrink-0 items-center justify-between gap-4 border-t border-[var(--nexus-border)] pl-[60px] pr-8 text-sm">
          <span className="text-[var(--nexus-text)]">
            <span className="text-[var(--nexus-inactive)]">Update</span>{" "}
            {formatDisplayDate(draftInformationArchitecture.generatedAt)}
          </span>
          <Button
            aria-label={isSaving ? "Saving information architecture" : undefined}
            className={cn(isSaving && pendingButtonClassName)}
            disabled={!recordId || !isDirty || isSaving}
            onClick={saveInformationArchitecture}
            variant="primary"
          >
            {isSaving ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : "Save"}
          </Button>
        </footer>
      </section>
    </div>
  )
}

// Compares only editable IA content so generated timestamps do not enable Save.
function getInformationArchitectureEditSignature(
  informationArchitecture: ScreenInformationArchitecture
) {
  return JSON.stringify({
    freeformText: informationArchitecture.freeformText
      ?? informationArchitectureToBulletList(informationArchitecture.regions),
    regions: informationArchitecture.regions,
  })
}

// Converts the editable IA tree into the indented bullet-list starting point for text mode.
function informationArchitectureToBulletList(regions: InformationArchitectureNode[]) {
  const lines: string[] = []
  const bulletMarkers = ["•", "◦", "▪", "•"]

  const visit = (nodes: InformationArchitectureNode[], depth: number) => {
    nodes.forEach((node) => {
      lines.push(`${"  ".repeat(depth)}${bulletMarkers[depth]} ${node.label}`)
      visit(node.children, depth + 1)
    })
  }

  visit(regions, 0)
  return lines.join("\n")
}

// Normalizes free-form input into the fixed two-space, four-level bullet format.
function normalizeInformationArchitectureBulletList(value: string) {
  return value.split(/\r?\n/).flatMap((line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return []

    const label = trimmedLine.replace(/^[-*•◦▪]\s*/, "").trim()
    if (!label) return []

    const indentation = line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length || 0
    const depth = Math.min(Math.floor(indentation / 2), 3)
    const bulletMarkers = ["•", "◦", "▪", "•"]
    return [`${"  ".repeat(depth)}${bulletMarkers[depth]} ${label}`]
  }).join("\n")
}

// Parses an indented bullet list into the same four-level IA tree used by tree mode.
function parseInformationArchitectureBulletList(value: string) {
  const regions: InformationArchitectureNode[] = []
  const stack: Array<{ depth: number; node: InformationArchitectureNode }> = []

  value.split("\n").forEach((line) => {
    const match = line.match(/^(\s*)[-*•◦▪]\s+(.+?)\s*$/)
    if (!match) return

    const depth = Math.min(Math.floor(match[1].replace(/\t/g, "  ").length / 2), 3)
    const node = createEditableInformationArchitectureNode(depth + 1)
    node.label = match[2]
    node.sourceName = match[2]

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]?.node
    if (parent) {
      parent.children.push(node)
    } else {
      regions.push(node)
    }
    stack.push({ depth, node })
  })

  return normalizeEditableInformationArchitectureNodes(regions)
}

function getInformationArchitectureBulletDepth(line: string) {
  const indentation = line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length || 0
  return Math.min(Math.floor(indentation / 2), 3)
}

function getInformationArchitectureBulletLabel(line: string) {
  return line.trim().replace(/^[-*•◦▪]\s*/, "").trim()
}

function getInformationArchitectureBulletMarker(depth: number) {
  return ["•", "◦", "▪", "•"][Math.min(depth, 3)]
}

function getInformationArchitectureBulletWeight(depth: number) {
  return depth === 0 ? "700" : depth === 1 ? "500" : "400"
}

function getInformationArchitectureBulletPrefix(depth: number) {
  const normalizedDepth = Math.min(Math.max(depth, 0), 3)
  return `${"  ".repeat(normalizedDepth)}${getInformationArchitectureBulletMarker(normalizedDepth)} `
}

// Renders one directly editable Markdown-like document with normalized bullets.
function InformationArchitectureTextEditor({
  informationArchitecture,
  onChange,
}: {
  informationArchitecture: ScreenInformationArchitecture
  onChange: (value: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const value = informationArchitecture.freeformText
    ?? informationArchitectureToBulletList(informationArchitecture.regions)
  const renderEditor = useCallback((nextValue: string) => {
    const editor = editorRef.current
    if (!editor) return

    editor.replaceChildren()
    const lines = nextValue ? nextValue.split("\n") : [""]

    lines.forEach((line) => {
      const depth = getInformationArchitectureBulletDepth(line)
      const lineElement = document.createElement("div")
      const label = getInformationArchitectureBulletLabel(line)

      lineElement.dataset.iaLine = "true"
      lineElement.dataset.depth = String(depth)
      lineElement.style.paddingLeft = `${depth * 32}px`
      lineElement.style.fontWeight = getInformationArchitectureBulletWeight(depth)
      lineElement.style.lineHeight = "32px"
      lineElement.style.minHeight = "32px"
      lineElement.style.whiteSpace = "pre-wrap"
      lineElement.textContent = `${getInformationArchitectureBulletMarker(depth)} ${label}`
      editor.append(lineElement)
    })
  }, [])

  const readEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return value

    return Array.from(editor.children)
      .filter((child): child is HTMLElement => (
        child instanceof HTMLElement && child.dataset.iaLine === "true"
      ))
      .map((line) => {
        const depth = Math.min(Number(line.dataset.depth) || 0, 3)
        return `${"  ".repeat(depth)}${getInformationArchitectureBulletPrefix(depth).trim()} ${getInformationArchitectureBulletLabel(line.textContent || "")}`
      })
      .join("\n")
  }, [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const currentValue = readEditor()
    if (currentValue !== value && normalizeInformationArchitectureBulletList(currentValue) !== value) {
      renderEditor(value)
    }
    if (editor.children.length === 0) renderEditor(value)
  }, [readEditor, renderEditor, value])

  const getSelectedLine = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.anchorNode) return null

    let node: Node | null = selection.anchorNode
    while (node && node !== editor) {
      if (node instanceof HTMLElement && node.dataset.iaLine === "true") return node
      node = node.parentNode
    }
    return null
  }

  const getSelectionOffset = (line: HTMLElement, node: Node, offset: number) => {
    const range = document.createRange()
    range.selectNodeContents(line)
    range.setEnd(node, offset)
    return range.toString().length
  }

  const setCaret = (line: HTMLElement, offset: number) => {
    const selection = window.getSelection()
    if (!selection) return

    const textNode = line.firstChild || line.appendChild(document.createTextNode(""))
    const range = document.createRange()
    range.setStart(textNode, Math.min(offset, textNode.textContent?.length || 0))
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const emitEditorChange = () => onChange(readEditor())

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== "Tab") return

    const editor = editorRef.current
    const selection = window.getSelection()
    const line = getSelectedLine()
    if (!editor || !selection?.rangeCount || !line) return

    event.preventDefault()
    const range = selection.getRangeAt(0)
    const lineText = line.textContent || ""
    const label = getInformationArchitectureBulletLabel(lineText)
    const labelStart = Math.max(lineText.length - label.length, 0)
    const startOffset = Math.max(0, getSelectionOffset(line, range.startContainer, range.startOffset) - labelStart)
    const endOffset = Math.max(0, getSelectionOffset(line, range.endContainer, range.endOffset) - labelStart)
    const currentDepth = Math.min(Number(line.dataset.depth) || 0, 3)

    if (event.key === "Tab") {
      const nextDepth = Math.min(Math.max(currentDepth + (event.shiftKey ? -1 : 1), 0), 3)
      const nextPrefix = getInformationArchitectureBulletPrefix(nextDepth)
      line.dataset.depth = String(nextDepth)
      line.style.paddingLeft = `${nextDepth * 32}px`
      line.style.fontWeight = getInformationArchitectureBulletWeight(nextDepth)
      line.textContent = `${nextPrefix}${label}`
      setCaret(line, nextPrefix.length + Math.min(startOffset, label.length))
      emitEditorChange()
      return
    }

    const splitAt = Math.min(startOffset, label.length)
    const deleteTo = Math.min(Math.max(endOffset, splitAt), label.length)
    const before = label.slice(0, splitAt)
    const after = label.slice(deleteTo)
    const currentPrefix = getInformationArchitectureBulletPrefix(currentDepth)
    const nextLine = document.createElement("div")
    nextLine.dataset.iaLine = "true"
    nextLine.dataset.depth = String(currentDepth)
    nextLine.style.paddingLeft = `${currentDepth * 32}px`
    nextLine.style.fontWeight = getInformationArchitectureBulletWeight(currentDepth)
    nextLine.style.lineHeight = "32px"
    nextLine.style.minHeight = "32px"
    nextLine.style.whiteSpace = "pre-wrap"
    nextLine.textContent = `${currentPrefix}${after}`
    line.textContent = `${currentPrefix}${before}`
    line.after(nextLine)
    setCaret(nextLine, currentPrefix.length)
    emitEditorChange()
  }

  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    const selection = window.getSelection()
    const line = getSelectedLine()
    if (!editor || !selection?.rangeCount || !line) return

    event.preventDefault()
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(event.clipboardData.getData("text")))
    const normalizedValue = normalizeInformationArchitectureBulletList(readEditor())
    renderEditor(normalizedValue)
    onChange(normalizedValue)
    const lastLine = editor.lastElementChild
    if (lastLine instanceof HTMLElement) setCaret(lastLine, lastLine.textContent?.length || 0)
  }

  return (
    <div
      aria-label="Information architecture text view"
      className="nexus-scrollbar min-h-[360px] flex-1 overflow-auto rounded-[12px] border border-[var(--nexus-border)] bg-white p-4 text-[14px] leading-8 outline-none focus-within:border-[var(--nexus-green)]/40 focus-within:ring-2 focus-within:ring-[var(--nexus-green)]/10"
      contentEditable
      onBlur={() => {
        const normalizedValue = normalizeInformationArchitectureBulletList(readEditor())
        renderEditor(normalizedValue)
        onChange(normalizedValue)
      }}
      onInput={emitEditorChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      ref={editorRef}
      role="textbox"
      spellCheck={false}
      suppressContentEditableWarning
    />
  )
}

// Renders the screen root and semantic descendants as an ordered vertical tree.
function InformationArchitectureGraph({
  informationArchitecture,
  onChange,
  screenName,
}: {
  informationArchitecture: ScreenInformationArchitecture
  onChange: (regions: InformationArchitectureNode[]) => void
  screenName: string
}) {
  // Adds one new top-level section to the editable IA tree.
  const addRootSection = () => {
    onChange([
      ...informationArchitecture.regions,
      createEditableInformationArchitectureNode(1),
    ])
  }

  return (
    <div className="relative min-w-[420px] pb-1">
      <div className="ml-8 flex h-10 items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--nexus-border)] bg-[var(--nexus-preview)] text-[#172036]">
          <HugeiconsIcon icon={HierarchySquare01Icon} size={24} strokeWidth={1.5} />
        </span>
        <p className="truncate text-[18px] font-semibold leading-9">{screenName}</p>
      </div>

      <div className="relative ml-[52px] mt-4 border-l border-[var(--nexus-border)] pb-1 before:absolute before:-top-[18px] before:-left-px before:h-[18px] before:border-l before:border-[var(--nexus-border)]">
        {informationArchitecture.regions.map((region, index) => (
          <InformationArchitectureGraphBranch
            isLast={index === informationArchitecture.regions.length - 1}
            key={`${region.sourceName}-${index}`}
            node={region}
            onAddChild={(path) => onChange(addInformationArchitectureChild(
              informationArchitecture.regions,
              path
            ))}
            onDelete={(path) => onChange(deleteInformationArchitectureNode(
              informationArchitecture.regions,
              path
            ))}
            onLabelChange={(path, label) => onChange(updateInformationArchitectureLabel(
              informationArchitecture.regions,
              path,
              label
            ))}
            path={[index + 1]}
          />
        ))}
        {informationArchitecture.regions.length === 0 ? (
          <p className="pl-[46px] pt-2 text-sm text-[var(--nexus-caption)]">No sections yet.</p>
        ) : null}

        <div className="-ml-[17px] mt-5">
          <Button
            aria-label="Add top-level section"
            className="size-8 rounded-[8px] text-[var(--nexus-caption)]"
            onClick={addRootSection}
            size="icon"
            title="Add section"
            variant="secondary"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Renders one editable semantic row with the reference tree connectors and actions.
function InformationArchitectureGraphBranch({
  isLast,
  node,
  onAddChild,
  onDelete,
  onLabelChange,
  path,
}: {
  isLast: boolean
  node: InformationArchitectureNode
  onAddChild: (path: number[]) => void
  onDelete: (path: number[]) => void
  onLabelChange: (path: number[], label: string) => void
  path: number[]
}) {
  const isTopLevel = path.length === 1
  const connectorWidthClassName = isTopLevel ? "w-8" : "w-9"
  const markerPositionClassName = isTopLevel ? "left-[29px]" : "left-8"
  const rowPaddingClassName = isTopLevel ? "pl-[46px]" : "pl-12"
  const childIndentClassName = isTopLevel ? "ml-[33px]" : "ml-9"

  return (
    <div className={cn("relative", !isLast && (isTopLevel ? "pb-6" : "pb-1"))}>
      {isLast ? (
        <span className="absolute -left-px bottom-0 top-[27px] z-[1] w-px bg-white" />
      ) : null}
      <span
        className={cn(
          "absolute -left-px top-0 h-[27px] rounded-bl-[12px] border-b border-l border-[var(--nexus-border)]",
          connectorWidthClassName
        )}
      />
      <span
        className={cn(
          "absolute top-[23px] size-2 rounded-full border border-[var(--nexus-border)] bg-[var(--nexus-preview)]",
          markerPositionClassName
        )}
      />
      <div className={cn("group flex h-9 items-center pr-5 pt-[9px]", rowPaddingClassName)}>
        <Input
          aria-label={`Edit ${node.label}`}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-[8px] border-transparent bg-transparent px-3 text-sm leading-9 shadow-none hover:border-[var(--nexus-border)] hover:bg-[var(--nexus-muted)] focus:border-[#d8d8d8] focus:bg-white focus:ring-1 focus:ring-[#ececec]",
            isTopLevel ? "text-base font-semibold" : "font-medium"
          )}
          value={node.label}
          onChange={(event) => onLabelChange(path, event.currentTarget.value)}
        />
        <div className="ml-3 flex shrink-0 items-center">
          {path.length < 4 ? (
            <Button
              aria-label={`Add child under ${node.label}`}
              className="size-8 rounded-[8px] text-[var(--nexus-caption)]"
              onClick={() => onAddChild(path)}
              size="icon"
              title="Add child"
              variant="ghost"
            >
              <Plus className="size-5" />
            </Button>
          ) : (
            <span className="size-8" />
          )}
          <Button
            aria-label={`Delete ${node.label}`}
            className="size-8 rounded-[8px] text-[var(--nexus-error)]"
            onClick={() => onDelete(path)}
            size="icon"
            title="Delete branch"
            variant="ghost"
          >
            <Trash2 className="size-5" />
          </Button>
        </div>
      </div>

      {node.children.length > 0 ? (
        <div className={cn("-mt-px border-l border-[var(--nexus-border)] pt-0", childIndentClassName)}>
          {node.children.map((child, index) => (
            <InformationArchitectureGraphBranch
              isLast={index === node.children.length - 1}
              key={`${child.sourceName}-${index}`}
              node={child}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onLabelChange={onLabelChange}
              path={[...path, index + 1]}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// Creates one manually editable IA node for the requested semantic depth.
function createEditableInformationArchitectureNode(depth: number): InformationArchitectureNode {
  const role: InformationArchitectureRole = depth === 1
    ? "section"
    : depth === 2
      ? "subsection"
      : "content"
  const label = depth === 1 ? "New section" : depth === 2 ? "New group" : "New item"

  return {
    children: [],
    confidence: "high",
    description: "Manually added information architecture item.",
    label,
    persistent: false,
    repeated: false,
    role,
    sequence: 1,
    sourceName: `Manual ${Date.now()}`,
    sourceType: "MANUAL",
  }
}

// Updates one IA node selected by its one-based hierarchy path.
function updateInformationArchitectureNode(
  nodes: InformationArchitectureNode[],
  path: number[],
  update: (node: InformationArchitectureNode) => InformationArchitectureNode
): InformationArchitectureNode[] {
  const [position, ...remainingPath] = path
  const index = position - 1

  return nodes.map((node, nodeIndex) => {
    if (nodeIndex !== index) return node
    if (remainingPath.length === 0) return update(node)
    return {
      ...node,
      children: updateInformationArchitectureNode(node.children, remainingPath, update),
    }
  })
}

// Changes the editable label of one IA node.
function updateInformationArchitectureLabel(
  nodes: InformationArchitectureNode[],
  path: number[],
  label: string
) {
  return updateInformationArchitectureNode(nodes, path, (node) => ({ ...node, label }))
}

// Adds a child beneath one node while respecting the four-level IA limit.
function addInformationArchitectureChild(
  nodes: InformationArchitectureNode[],
  path: number[]
) {
  if (path.length >= 4) return nodes
  return updateInformationArchitectureNode(nodes, path, (node) => ({
    ...node,
    children: [
      ...node.children,
      createEditableInformationArchitectureNode(path.length + 1),
    ],
  }))
}

// Deletes one IA node and every descendant beneath it.
function deleteInformationArchitectureNode(
  nodes: InformationArchitectureNode[],
  path: number[]
): InformationArchitectureNode[] {
  const [position, ...remainingPath] = path
  const index = position - 1
  if (remainingPath.length === 0) return nodes.filter((_, nodeIndex) => nodeIndex !== index)

  return nodes.map((node, nodeIndex) => nodeIndex === index
    ? {
      ...node,
      children: deleteInformationArchitectureNode(node.children, remainingPath),
    }
    : node
  )
}

// Renumbers editable siblings after additions or deletions.
function normalizeEditableInformationArchitectureNodes(
  nodes: InformationArchitectureNode[]
): InformationArchitectureNode[] {
  return nodes.map((node, index) => ({
    ...node,
    children: normalizeEditableInformationArchitectureNodes(node.children),
    sequence: index + 1,
  }))
}

// Counts all nodes in one editable IA tree, optionally applying a role predicate.
function countEditableInformationArchitectureNodes(
  nodes: InformationArchitectureNode[],
  predicate: (node: InformationArchitectureNode) => boolean = () => true
): number {
  return nodes.reduce((total, node) => (
    total
    + (predicate(node) ? 1 : 0)
    + countEditableInformationArchitectureNodes(node.children, predicate)
  ), 0)
}

// Rebuilds IA metadata after a manual tree edit.
function rebuildEditableInformationArchitecture(
  informationArchitecture: ScreenInformationArchitecture,
  regions: InformationArchitectureNode[]
): ScreenInformationArchitecture {
  const normalizedRegions = normalizeEditableInformationArchitectureNodes(regions)
  return {
    ...informationArchitecture,
    analysisMode: normalizedRegions.length > 0 ? "structure-first" : informationArchitecture.analysisMode,
    coverageNote: normalizedRegions.length > 0
      ? "Node-derived information architecture with manual edits."
      : informationArchitecture.coverageNote,
    elementCount: countEditableInformationArchitectureNodes(normalizedRegions),
    generatedAt: new Date().toISOString(),
    regions: normalizedRegions,
    textCount: countEditableInformationArchitectureNodes(
      normalizedRegions,
      (node) => node.role === "label" || node.role === "text"
    ),
  }
}

// Converts an app slug into the label shown in the UI.
function getAppLabel(value: AppSlug) {
  return apps.find((app) => app.value === value)?.label || "Consumer App"
}

// Checks whether a gallery item still has the older editable component pull fallback.
function hasEditablePullTarget(item: GalleryItem) {
  return Boolean(item.componentKey || item.storageNodeId)
}

// Applies one pasted file URL to each selected frame by replacing its node-id query value.
function addNodeIdToSourceUrl(sourceUrl: string, nodeId: string) {
  if (!sourceUrl.trim()) return ""

  try {
    const url = new URL(sourceUrl.trim())
    url.searchParams.set("node-id", nodeId.replace(/:/g, "-"))
    return url.toString()
  } catch {
    return sourceUrl
  }
}

// Gets a direct Figma node URL from saved metadata, including older records with only file/node ids.
function getScreenSourceUrl(record?: ScreenRecord) {
  if (!record) return undefined
  if (record.sourceNodeUrl) return record.sourceNodeUrl
  if (!record.sourceFileKey || !record.sourceNodeId) return undefined

  const fileName = encodeURIComponent((record.sourceFileName || "Figma").trim().replace(/\s+/g, "-"))
  const nodeId = encodeURIComponent(record.sourceNodeId.replace(/:/g, "-"))
  return `https://www.figma.com/design/${record.sourceFileKey}/${fileName}?node-id=${nodeId}`
}

// Keeps console output focused on the fields needed to debug source URL routing.
function debugRecordUrl(record: ScreenRecord) {
  return {
    id: record.id,
    screenName: record.screenName,
    sourceFileKey: record.sourceFileKey,
    sourceNodeId: record.sourceNodeId,
    sourceNodeUrl: record.sourceNodeUrl,
  }
}

// Returns the first character used in the detail author avatar.
function getNameInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?"
}

// Formats stored ISO timestamps for the screen detail metadata.
function formatDisplayDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

// Builds a stable collection key from the app, team, and feature hierarchy.
function getFeatureCollectionId(screen: Pick<NexusScreen, "app" | "category" | "platform">) {
  return [screen.app, screen.category, screen.platform]
    .map((value) => value.trim().toLowerCase())
    .join("::")
}

// Groups individual stored screen records under their matching app, team, and feature.
function groupScreensByFeature(screens: NexusScreen[]): FeatureCollection[] {
  const collections = new Map<string, FeatureCollection>()

  for (const screen of screens) {
    const id = getFeatureCollectionId(screen)
    const existing = collections.get(id)

    if (existing) {
      existing.screens.push(screen)
      existing.count = `${existing.screens.length} screens`
      continue
    }

    collections.set(id, {
      app: screen.app,
      count: "1 screen",
      featureName: screen.platform,
      id,
      previewImage: screen.previewImage,
      screens: [screen],
      team: screen.category,
    })
  }

  return Array.from(collections.values())
}

// Creates one gallery item so the card, detail view, and screen URL action all use the same clicked data.
function getGalleryItem(screen: NexusScreen): GalleryItem {
  return {
    componentKey: screen.record?.componentKey,
    detailImage: screen.record?.previewImageDataUrl || "",
    id: screen.record?.id || screen.id,
    opens: String(screen.record?.pullCount || 0),
    record: screen.record,
    screen,
    size: screen.record?.deviceSize || screen.size,
    storageNodeId: screen.record?.storageNodeId,
    thumbnail: screen.record?.previewImageDataUrl || "",
    title: screen.record?.screenName || screen.title,
    views: String(screen.record?.viewCount || 0),
  }
}

// Converts a stored metadata record into a browse card record.
function recordToNexusScreen(record: ScreenRecord): NexusScreen {
  return {
    app: appLabelToSlug(record.app),
    category: record.team,
    id: record.id,
    platform: record.featureName,
    previewImage: record.previewImageDataUrl,
    record,
    size: record.deviceSize,
    title: record.screenName,
  }
}

// Maps product labels from the push form back to the tab slug used by the UI.
function appLabelToSlug(label: string): AppSlug {
  return apps.find((app) => app.label === label)?.value || "consumer"
}

createRoot(document.getElementById("app") as HTMLElement).render(<App />)
