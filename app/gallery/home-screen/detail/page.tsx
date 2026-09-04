import { AppHeader } from "@/components/nexus/app-header"
import { DetailModal } from "@/components/nexus/detail-modal"
import { GalleryGrid } from "@/components/nexus/gallery-grid"
import { GalleryTitleBar } from "@/components/nexus/gallery-title-bar"

export default function HomeScreenDetailRoute() {
  return (
    <>
      <AppHeader />
      <main aria-hidden="true">
        <GalleryTitleBar />
        <GalleryGrid muted />
      </main>
      <DetailModal />
    </>
  )
}
