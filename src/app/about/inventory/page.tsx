import Link from 'next/link';
import type { Metadata } from 'next';
import ArchiveNavigation from '@/components/archive-navigation';
import ProgrammableChecklist from '@/components/programmable-checklist';
export const metadata: Metadata = {
  title: 'Programmable art inventory | Async Art',
  description:
    'Timers, price-driven art, collector controls and restoration checks across the Async archive.',
};
export default function ProgrammablePage() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <Link href="/about" className="text-sm text-accent underline">
        About this restoration
      </Link>
      <div className="mt-6">
        <ArchiveNavigation active="programmable" />
      </div>
      <p className="text-accent text-xs font-semibold uppercase tracking-widest">
        Digital Rescue Lab · Restoration checks
      </p>
      <h1 className="mt-4 text-4xl sm:text-5xl font-bold">
        Programmable art inventory
      </h1>
      <p className="mt-5 text-lg text-text-muted max-w-3xl">
        Find time-based pieces, price-driven art and collector-controlled works.
        Open a piece, check its behavior, and keep your own review list.
      </p>
      <ProgrammableChecklist />
    </main>
  );
}
