import { GalleryPreviewCard } from "@/components/nexus/gallery-preview-card"
import {
  getScreenDetailHref,
  type NexusScreenRecord,
} from "@/lib/nexus-data"

type SearchScreenCardProps = {
  priority?: boolean
  record: NexusScreenRecord
}

// Renders an individual raw screen record for search results, never its parent feature.
export function SearchScreenCard({ priority, record }: SearchScreenCardProps) {
  const href = getScreenDetailHref(record)

  return (
    <div className="flex h-[400px] justify-center sm:h-[477px] lg:h-[548px]">
      <div className="origin-top scale-[0.73] sm:scale-[0.87] lg:scale-100">
        <GalleryPreviewCard
          href={href}
          image={record.previewImageDataUrl}
          platform={record.team}
          priority={priority}
          recordId={record.id}
          sourceUrl={record.sourceNodeUrl}
          title={record.screenName}
        />
      </div>
    </div>
  )
}
