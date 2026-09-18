import { NextResponse } from "next/server"

import type { NexusScreenRecord } from "@/lib/nexus-data"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Rejects the checked-in placeholder values before initializing Supabase.
function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || ""
  return Boolean(url && key && !url.includes("your-project") && !/your-(anon|publishable)-key/.test(key))
}

// Serves the current shared screen records to the interactive website.
export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("nexus_screens")
    .select("record, preview_url")
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const records = (data || []).map((row) => {
    const record = row.record as NexusScreenRecord
    return {
      ...record,
      previewImageDataUrl: row.preview_url || record.previewImageDataUrl || "",
    }
  })

  return NextResponse.json({ records })
}
