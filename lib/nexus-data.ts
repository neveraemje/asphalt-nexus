export type ProductPlatform = {
  name: string
  slug: AppSlug
  href: string
  description: string
}

export type AppSlug = "consumer" | "merchant" | "driver"

export type ScreenCard = {
  id: string
  title: string
  platform: string
  app: AppSlug
  category: string
  count: string
  image: string
  href: string
  searchText: string
}

export type InformationArchitectureNode = {
  children: InformationArchitectureNode[]
  label: string
}

export type NexusScreenRecord = {
  app: string
  createdAt: string
  createdByName: string
  deviceSize: string
  featureName: string
  id: string
  informationArchitecture?: {
    regions: InformationArchitectureNode[]
  }
  previewImageDataUrl: string
  pullCount: number
  screenName: string
  sourceNodeUrl?: string
  status: string
  team: string
  updatedAt: string
  viewCount: number
}

export type ScreenVariant = {
  id: string
  title: string
  platform: string
  app: AppSlug
  category: string
  image: string
  href: string
  pulls: number
  size: string
  sourceUrl?: string
  updatedAt: string
  createdByName: string
  views: number
  architecture: InformationArchitectureNode[]
}

type SearchParamReader = {
  get: (name: string) => string | null
}

export const platforms: ProductPlatform[] = [
  {
    name: "Consumer App",
    slug: "consumer",
    href: "/?app=consumer",
    description: "End-user application screens.",
  },
  {
    name: "Merchant App",
    slug: "merchant",
    href: "/?app=merchant",
    description: "Merchant partner application screens.",
  },
  {
    name: "Driver App",
    slug: "driver",
    href: "/?app=driver",
    description: "Driver partner application screens.",
  },
]

// Normalizes the persisted app label into the URL slug used by the website.
export function resolveAppSlug(app?: string | null): AppSlug {
  const normalized = (app || "").toLowerCase()
  if (normalized.includes("merchant")) return "merchant"
  if (normalized.includes("driver")) return "driver"
  return "consumer"
}

// Resolves the active product directly from the current query parameters.
export function getActiveAppFromParams(searchParams: SearchParamReader): AppSlug {
  return resolveAppSlug(searchParams.get("app"))
}

// Groups individual database records into product feature cards.
export function recordsToScreenCards(records: NexusScreenRecord[]): ScreenCard[] {
  const groups = new Map<string, NexusScreenRecord[]>()

  records.forEach((record) => {
    const id = createCollectionId(record)
    groups.set(id, [...(groups.get(id) || []), record])
  })

  return Array.from(groups.entries()).map(([id, groupedRecords]) => {
    const first = groupedRecords[0]
    const count = groupedRecords.length
    return {
      app: resolveAppSlug(first.app),
      category: first.team,
      count: `${count} ${count === 1 ? "Screen" : "Screens"}`,
      href: `/gallery/home-screen?id=${encodeURIComponent(id)}`,
      id,
      image: first.previewImageDataUrl,
      platform: first.team,
      searchText: groupedRecords
        .flatMap((record) => [record.screenName, record.featureName, record.team, record.app])
        .join(" ")
        .toLowerCase(),
      title: first.featureName,
    }
  })
}

// Finds one feature collection without inventing a fallback record.
export function getScreenById(cards: ScreenCard[], id?: string | null) {
  if (!id) return cards[0]
  return cards.find((screen) => screen.id === id)
}

// Returns the real pushed screens within one feature collection.
export function getGalleryScreens(
  records: NexusScreenRecord[],
  collectionId?: string | null
): ScreenVariant[] {
  return records
    .filter((record) => !collectionId || createCollectionId(record) === collectionId)
    .map((record) => ({
      app: resolveAppSlug(record.app),
      architecture: record.informationArchitecture?.regions || [],
      category: record.team,
      createdByName: record.createdByName,
      href: `/gallery/home-screen/detail?id=${encodeURIComponent(createCollectionId(record))}&variant=${encodeURIComponent(record.id)}`,
      id: record.id,
      image: record.previewImageDataUrl,
      platform: record.team,
      pulls: record.pullCount || 0,
      size: record.deviceSize,
      sourceUrl: record.sourceNodeUrl,
      title: record.screenName,
      updatedAt: record.updatedAt,
      views: record.viewCount || 0,
    }))
}

// Selects one real screen record from a collection.
export function getGalleryVariant(variants: ScreenVariant[], variant?: string | null) {
  return variants.find((screen) => screen.id === variant) || variants[0]
}

// Formats compact metadata numbers for the detail panel.
export function formatViews(value: number) {
  return value.toLocaleString("en-US")
}

// Builds a stable collection identity from the app, team, and feature hierarchy.
function createCollectionId(record: NexusScreenRecord) {
  return `${resolveAppSlug(record.app)}:${record.team}:${record.featureName}`
}
