import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Gallery from '@/components/gallery/Gallery';
import ArchiveNavigation from '@/components/archive-navigation';
import ArchiveSearchForm from '@/components/archive-search-form';
import { archiveFamilies } from '@/utils/archive-families';
import { getMastersGalleryItems } from '@/utils/masters';
import ArchiveResults from '@/components/archive-results';
import { searchArchive } from '@/utils/archive-search';
import musicIdentities from '@/data/music-identities.json';

export function generateStaticParams() {
  return archiveFamilies.map((f) => ({ family: f.id }));
}
export function generateMetadata({
  params,
}: {
  params: { family: string };
}): Metadata {
  return {
    title: `${archiveFamilies.find((f) => f.id === params.family)?.title ?? 'Archive'} | Async Art`,
  };
}
export default function ArchivePage({
  params,
}: {
  params: { family: string };
}) {
  const family = archiveFamilies.find((f) => f.id === params.family);
  if (!family) notFound();
  const recovered = searchArchive('', family.id);
  const isMusic = family.id === 'music';
  const items = getMastersGalleryItems()
    .filter((item) => {
      const music = musicIdentities.some(
        (m) =>
          m.contractAddress === item.contractAddress?.toLowerCase() &&
          m.tokenId === item.tokenId,
      );
      return isMusic ? music : !music;
    })
    .map((item) => ({
      ...item,
      link: item.link.replace('referrer=masters', `referrer=${family.id}`),
    }));
  return (
    <main className="container mx-auto px-4 py-10 max-w-6xl">
      <Link
        href="/"
        className="text-sm text-accent underline inline-block mb-6"
      >
        Back to the archive
      </Link>
      <h1 className="text-3xl sm:text-4xl font-bold mb-4">{family.title}</h1>
      <p className="text-lg text-text-muted max-w-3xl mb-6">
        {family.description}
      </p>
      <ArchiveNavigation active={family.id} />
      <div className="rounded-xl border border-border bg-surface-sunken p-5 mb-8">
        <ArchiveSearchForm family={family.id} />
      </div>
      {family.id === 'classic' || isMusic ? (
        <>
          <p className="text-text-muted mb-8">
            {isMusic
              ? 'These 17 music masters are identified in the recovery inventory. Open an artwork to play its original stems and preview musical variants. Original server mastering is still being restored, and availability depends on surviving IPFS files. This is a starting catalog, not the complete Async Music collection.'
              : 'Browse the current classic master catalog, including layered and automated works. Restoration varies by piece; missing assets and original behavior remain under review.'}
          </p>
          <Gallery
            title={isMusic ? 'Music masters' : 'Classic masters'}
            items={items}
            embedded
            defaultSortOption="date"
          />
        </>
      ) : (
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            {family.id === 'blueprints'
              ? 'Blueprint editions'
              : 'Dynamic Blueprint expansion items'}
          </h2>
          <p className="text-text-muted mb-6">
            {recovered.total.toLocaleString('en-US')} recovered records.
            Previews load from original metadata as you browse.
            {family.id === 'dynamic-blueprints'
              ? ' These are individual expansion items; restoring the changing core compositions is the next step.'
              : ' Images may show earlier or unrevealed states. Interactive viewers remain under restoration.'}
          </p>
          <ArchiveResults records={recovered.results} />
          <Link
            className="btn-primary inline-block mt-8"
            href={`/search?family=${family.id}`}
          >
            Browse and search all {recovered.total.toLocaleString('en-US')}{' '}
            records
          </Link>
        </section>
      )}
    </main>
  );
}
