"use client"

import * as React from "react"

import {
  recordsToScreenCards,
  type NexusScreenRecord,
  type ScreenCard,
} from "@/lib/nexus-data"

type NexusDataContextValue = {
  error: string
  incrementMetric: (recordId: string, metric: NexusMetric) => Promise<void>
  loading: boolean
  records: NexusScreenRecord[]
  screenCards: ScreenCard[]
}

type NexusMetric = "open" | "view"

const NexusDataContext = React.createContext<NexusDataContextValue | undefined>(undefined)

// Loads the shared Supabase catalog once and exposes it to all interactive routes.
export function NexusDataProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = React.useState<NexusScreenRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    const controller = new AbortController()

    async function loadRecords() {
      try {
        const response = await fetch("/api/screens", {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = await response.json() as { error?: string; records?: NexusScreenRecord[] }
        if (!response.ok) throw new Error(payload.error || "Could not load screens.")
        setRecords(payload.records || [])
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : "Could not load screens.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadRecords()
    return () => controller.abort()
  }, [])

  const incrementMetric = React.useCallback(async (
    recordId: string,
    metric: NexusMetric
  ) => {
    const response = await fetch(`/api/screens/${encodeURIComponent(recordId)}/metrics`, {
      body: JSON.stringify({ metric }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
    const payload = await response.json() as {
      error?: string
      metrics?: Pick<NexusScreenRecord, "id" | "pullCount" | "viewCount">
    }

    if (!response.ok || !payload.metrics) {
      throw new Error(payload.error || "Could not update the screen metric.")
    }

    const metrics = payload.metrics
    setRecords((currentRecords) => currentRecords.map((record) => (
      record.id === metrics.id
        ? {
            ...record,
            pullCount: metrics.pullCount,
            viewCount: metrics.viewCount,
          }
        : record
    )))
  }, [])

  const value = React.useMemo(() => ({
    error,
    incrementMetric,
    loading,
    records,
    screenCards: recordsToScreenCards(records),
  }), [error, incrementMetric, loading, records])

  return <NexusDataContext.Provider value={value}>{children}</NexusDataContext.Provider>
}

// Returns the shared database state and fails clearly outside its provider.
export function useNexusData() {
  const context = React.useContext(NexusDataContext)
  if (!context) throw new Error("useNexusData must be used inside NexusDataProvider.")
  return context
}
