import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Layers,
  Music,
  Grid,
  Sliders,
  Disc,
  Users,
} from 'react-feather';
import firstSupperHero from '../../public/first-supper-0.jpg';
import ArchiveSearchForm from '@/components/archive-search-form';
import { archiveFamilies } from '@/utils/archive-families';

const icons = {
  classic: Layers,
  music: Music,
  'music-blueprints': Disc,
  blueprints: Grid,
  'dynamic-blueprints': Sliders,
};

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-10 sm:py-16 max-w-6xl">
      <section className="mb-10">
        <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-4">
          <a
            href="https://digitalrescuelab.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Digital Rescue Lab
          </a>{' '}
          · Archive restoration
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl">
          Keep the art alive.
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mt-5 leading-relaxed">
          Explore the Async Art archive. We’re restoring the original artworks,
          music, layers, and changing compositions so they can be experienced
          again.
        </p>
        <Link
          href="/archive/music-blueprints"
          className="inline-flex items-center gap-2 text-accent underline mt-5"
        >
          <Disc size={18} aria-hidden="true" />
          Explore Music Blueprints
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <aside
          aria-labelledby="rescue-lab-heading"
          className="mt-7 rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5"
        >
          <div className="flex-1">
            <h2 id="rescue-lab-heading" className="text-xl font-semibold">
              Help Digital Rescue Lab keep the art alive.
            </h2>
            <p className="mt-2 text-sm text-text-muted leading-relaxed">
              Meet the community restoring early blockchain artworks and follow
              the work to preserve them.
            </p>
          </div>
          <a
            href="https://digitalrescuelab.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 shrink-0"
          >
            Visit Digital Rescue Lab
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </aside>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {archiveFamilies.map((family) => {
            const Icon = icons[family.id];
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
          <Link
            href="/artists"
            className="group rounded-2xl border border-border bg-surface-raised p-5 flex flex-col hover:border-accent transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <div className="flex justify-between items-center mb-7">
              <Users className="text-accent" size={25} aria-hidden="true" />
              <ArrowUpRight
                size={20}
                className="text-text-muted group-hover:text-accent"
                aria-hidden="true"
              />
            </div>
            <h3 className="text-xl font-semibold mb-3">Artists</h3>
            <p className="text-sm text-text-muted leading-relaxed flex-1">
              Meet the artists and musicians behind Async. Explore restored
              profiles, artworks, and projects.
            </p>
            <p className="text-xs text-accent mt-6 pt-4 border-t border-border">
              Biographies and portraits from the original archive
            </p>
          </Link>
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
        <div id="support" className="scroll-mt-28">
          <h2 className="text-xl font-semibold mb-3">
            Support the restoration
          </h2>
          <p className="text-text-muted leading-relaxed">
            Digital Rescue Lab runs on volunteer effort. Contributions help
            cover hosting, asset preservation, and the work of bringing these
            pieces back.
          </p>
          <p className="text-sm text-text-muted leading-relaxed mt-3">
            Digital Rescue Lab’s website lists digitalrescuelab.eth and says a
            new fundraising campaign is coming soon. You can donate directly
            using the Ethereum address in the banner above.
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <a
              href="https://digitalrescuelab.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Visit Digital Rescue Lab ↗
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
