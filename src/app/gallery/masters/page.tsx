import Gallery from '@/components/gallery/Gallery';
import { getMastersGalleryItems } from '@/utils/masters';

export default function MastersGalleryPage() {
  const items = getMastersGalleryItems();

  return <Gallery title="Async Art Restored Masters Gallery" items={items} />;
}
