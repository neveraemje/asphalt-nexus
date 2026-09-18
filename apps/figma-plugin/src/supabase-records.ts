const bucketName = "nexus-screen-previews"
const tableName = "nexus_screens"

type ScreenRow = {
  id: string
  preview_url: string | null
  record: ScreenRecord
}

type StoredScreenRow = Pick<ScreenRow, "id" | "preview_url">

// Returns validated build-time settings without using Figma's unavailable URL constructor.
function getSupabaseConfig() {
  const url = __NEXUS_SUPABASE_URL__.trim().replace(/\/+$/, "")
  const key = __NEXUS_SUPABASE_ANON_KEY__.trim()

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild the plugin."
    )
  }

  return { key, url }
}

// Sends one authenticated request using APIs supported by the Figma plugin sandbox.
async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { key, url } = getSupabaseConfig()
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  })
  const body = await response.text()

  if (!response.ok) {
    let message = body || `${response.status} ${response.statusText}`
    try {
      const payload = JSON.parse(body) as { error?: string; message?: string }
      message = payload.message || payload.error || message
    } catch {
      // Keep the raw response when the endpoint does not return JSON.
    }
    throw new Error(message)
  }

  return (body ? JSON.parse(body) : undefined) as T
}

// Loads the shared screen collection in newest-first order.
export async function loadDatabaseRecords(): Promise<ScreenRecord[]> {
  const rows = await supabaseRequest<ScreenRow[]>(
    `/rest/v1/${tableName}?select=id,preview_url,record&order=updated_at.desc`
  )

  return rows.map((row) => ({
    ...row.record,
    previewImageDataUrl: row.preview_url || row.record.previewImageDataUrl || "",
  }))
}

// Reconciles the complete plugin record list with Supabase and removes deleted previews.
export async function saveDatabaseRecords(records: ScreenRecord[]) {
  const persistedRecords = await Promise.all(records.map(persistPreviewImage))
  const existingRows = await supabaseRequest<StoredScreenRow[]>(
    `/rest/v1/${tableName}?select=id,preview_url`
  )
  const retainedIds = new Set(persistedRecords.map((record) => record.id))
  const removedRows = existingRows.filter((row) => !retainedIds.has(row.id))

  if (removedRows.length > 0) {
    const previewPaths = removedRows
      .map((row) => getPreviewPath(row.preview_url))
      .filter((path): path is string => Boolean(path))

    if (previewPaths.length > 0) {
      await supabaseRequest(`/storage/v1/object/${bucketName}`, {
        body: JSON.stringify({ prefixes: previewPaths }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      })
    }

    await Promise.all(
      removedRows.map((row) => supabaseRequest(
        `/rest/v1/${tableName}?id=eq.${encodeURIComponent(row.id)}`,
        { method: "DELETE" }
      ))
    )
  }

  if (persistedRecords.length === 0) return

  await supabaseRequest(`/rest/v1/${tableName}?on_conflict=id`, {
    body: JSON.stringify(persistedRecords.map((record) => ({
      app: record.app,
      created_at: record.createdAt,
      feature_name: record.featureName,
      id: record.id,
      preview_url: record.previewImageDataUrl || null,
      record,
      screen_name: record.screenName,
      source_node_url: record.sourceNodeUrl || null,
      status: record.status,
      team: record.team,
      updated_at: record.updatedAt,
    }))),
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    method: "POST",
  })
}

// Uploads newly exported data URLs and stores only their public URL in Postgres.
async function persistPreviewImage(record: ScreenRecord): Promise<ScreenRecord> {
  if (!record.previewImageDataUrl.startsWith("data:")) return record

  const preview = decodeDataUrl(record.previewImageDataUrl)
  const extension = preview.mimeType === "image/png"
    ? "png"
    : preview.mimeType === "image/webp"
      ? "webp"
      : "jpg"
  const path = `${record.id}.${extension}`

  await supabaseRequest(`/storage/v1/object/${bucketName}/${encodeURIComponent(path)}`, {
    body: preview.bytes as unknown as BodyInit,
    headers: {
      "Cache-Control": "max-age=3600",
      "Content-Type": preview.mimeType,
      "x-upsert": "true",
    },
    method: "POST",
  })

  const { url } = getSupabaseConfig()
  return {
    ...record,
    previewImageDataUrl: `${url}/storage/v1/object/public/${bucketName}/${encodeURIComponent(path)}`,
  }
}

// Converts a browser data URL into the byte payload expected by Supabase Storage.
function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error("The exported preview is not a valid base64 image.")

  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return { bytes, mimeType: match[1] }
}

// Extracts the object path from one public Supabase Storage URL.
function getPreviewPath(previewUrl?: string | null) {
  if (!previewUrl) return undefined
  const marker = `/storage/v1/object/public/${bucketName}/`
  const markerIndex = previewUrl.indexOf(marker)
  if (markerIndex === -1) return undefined
  return decodeURIComponent(previewUrl.slice(markerIndex + marker.length))
}
