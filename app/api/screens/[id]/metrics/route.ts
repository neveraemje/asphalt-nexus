import { NextResponse } from "next/server"

import type { NexusScreenRecord } from "@/lib/nexus-data"
import { createClient } from "@/lib/supabase/server"

type NexusMetric = "open" | "view"

// Rejects the checked-in placeholder values before initializing Supabase.
function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ""
  return Boolean(url && key && !url.includes("your-project") && !/your-(anon|publishable)-key/.test(key))
}

// Persists web activity in the same counters used by the Figma plugin.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null) as { metric?: NexusMetric } | null
  const metric = body?.metric

  if (metric !== "open" && metric !== "view") {
    return NextResponse.json({ error: "Metric must be open or view." }, { status: 400 })
  }

  const supabase = await createClient()

  // Compare the JSON we read before writing so overlapping view/open requests
  // retry instead of replacing each other's counters.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: existingRow, error: readError } = await supabase
      .from("nexus_screens")
      .select("record")
      .eq("id", id)
      .single()

    if (readError || !existingRow) {
      return NextResponse.json(
        { error: readError?.message || "Screen not found." },
        { status: readError?.code === "PGRST116" ? 404 : 500 }
      )
    }

    const currentRecord = existingRow.record as NexusScreenRecord
    const currentPullCount = Number(currentRecord.pullCount) || 0
    const currentViewCount = Number(currentRecord.viewCount) || 0
    const nextRecord: NexusScreenRecord = {
      ...currentRecord,
      pullCount: metric === "open"
        ? currentPullCount + 1
        : currentPullCount,
      viewCount: metric === "view"
        ? currentViewCount + 1
        : currentViewCount,
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("nexus_screens")
      .update({ record: nextRecord })
      .eq("id", id)
      .eq("record->>pullCount", String(currentPullCount))
      .eq("record->>viewCount", String(currentViewCount))
      .select("id")
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (updatedRow) {
      return NextResponse.json({
        metrics: {
          id,
          pullCount: nextRecord.pullCount,
          viewCount: nextRecord.viewCount,
        },
      })
    }
  }

  return NextResponse.json(
    { error: "The screen metric changed too quickly. Please try again." },
    { status: 409 }
  )
}
