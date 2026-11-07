import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Layers, Music, Grid, Sliders } from 'react-feather';
import firstSupperHero from '../../public/first-supper-0.jpg';
import ArchiveSearchForm from '@/components/archive-search-form';
import { archiveFamilies } from '@/utils/archive-families';

const icons = [Layers, Music, Grid, Sliders];

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-10 sm:py-16 max-w-6xl">
      <section className="mb-10">
        <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-4">
          Digital Rescue Lab · Archive restoration
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl">
          Keep the art alive.
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mt-5 leading-relaxed">
          Explore the Async Art archive. We’re restoring the original artworks,
          music, layers, and changing compositions so they can be experienced
          again.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-surface-sunken p-5 sm:p-6">
          <ArchiveSearchForm />
        </div>
      </section>
      <section
        aria-labelledby="collections-heading"
        id="collections"
        className="mb-12 scroll-mt-28"
      >
        <div className="flex flex-wrap justify-between items-end gap-3 mb-5">
          <h2 id="collections-heading" className="text-2xl font-semibold">
            Explore the archive
          </h2>
          <Link href="/search" className="text-sm text-accent underline">
            Search all collections
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {archiveFamilies.map((family, index) => {
            const Icon = icons[index];
            return (
              <Link
                href={`/archive/${family.id}`}
                key={family.id}
                className="group rounded-2xl border border-border bg-surface-raised p-5 flex flex-col hover:border-accent transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex justify-between items-center mb-7">
                  <Icon className="text-accent" size={25} aria-hidden="true" />
                  <ArrowUpRight
                    size={20}
                    className="text-text-muted group-hover:text-accent"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-xl font-semibold mb-3">{family.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed flex-1">
                  {family.description}
                </p>
                <p className="text-xs text-accent mt-6 pt-4 border-t border-border">
                  {family.status}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="mb-12">
        <Link href="/v2/0?referrer=masters" className="group block">
          <div className="rounded-2xl overflow-hidden bg-surface-sunken">
            <Image
              src={firstSupperHero}
              alt="First Supper, a collaborative Async artwork"
              priority
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="w-full h-auto"
            />
          </div>
          <div className="flex justify-between items-center mt-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest">
                From the archive
              </p>
              <h2 className="text-2xl font-semibold mt-1 group-hover:text-accent">
                First Supper
              </h2>
            </div>
            <ArrowUpRight aria-hidden="true" />
          </div>
        </Link>
      </section>
      <section
        className="grid md:grid-cols-2 gap-8 border-t border-border pt-8"
        id="restoration"
      >
        <div>
          <h2 className="text-xl font-semibold mb-3">
            Restoring the originals
          </h2>
          <p className="text-text-muted leading-relaxed">
            This archive preserves existing Async works and restores their
            original behavior. You can explore available layers and preview
            changes. Some assets, controls, and music playback are still being
            recovered.
          </p>
          <Link
            href="/gallery/layers"
            className="text-accent underline inline-block mt-4"
          >
            Explore classic layers
          </Link>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-3">
            Support the restoration
          </h2>
          <p className="text-text-muted leading-relaxed">
            Digital Rescue Lab runs on volunteer effort. Contributions help
            cover hosting, asset preservation, and the work of bringing these
            pieces back.
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <a
              href="https://juicebox.money/v5/eth:70"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Support the archive ↗
            </a>
            <a
              href="https://x.com/ArtRescueLab"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Restoration updates ↗
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
