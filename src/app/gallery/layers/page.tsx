import Gallery from '@/components/gallery/Gallery';
import { getLayersGalleryItems } from '@/utils/layers';

export default function LayersGalleryPage() {
  const items = getLayersGalleryItems();

  return (
    <Gallery title="Async Art Layers Gallery (incomplete)" items={items} />
  );
}
